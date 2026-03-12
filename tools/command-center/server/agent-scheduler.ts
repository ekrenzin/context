import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { Manager } from "./manager.js";
import type {
  AgentJob,
  AgentJobType,
  AgentJobStatus,
  AgentJobTrigger,
  AgentSchedulerState,
  FingerprintSources,
} from "./types.js";

const INTERVAL_MS = 60 * 60 * 1000;
const MAX_JOBS = 100;
const LOG_TAIL_LINES = 20;

const KNOWN_REPOS: string[] = [];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fingerprintTranscripts(transcriptDir: string): string {
  try {
    const entries = fs.readdirSync(transcriptDir);
    const count = entries.length;
    const mtimes = entries.map((f) => {
      try {
        return fs.statSync(path.join(transcriptDir, f)).mtimeMs;
      } catch {
        return 0;
      }
    });
    const latest = mtimes.length > 0 ? Math.max(...mtimes) : 0;
    return `${count}:${latest}`;
  } catch {
    return "0:0";
  }
}

function fingerprintRepos(root: string): string {
  const parts: string[] = [];
  for (const name of KNOWN_REPOS) {
    const repoPath = path.join(root, "repos", name);
    try {
      const sha = execSync(`git -C "${repoPath}" rev-parse HEAD 2>/dev/null`, {
        encoding: "utf8",
        timeout: 3000,
      })
        .trim()
        .slice(0, 8);
      parts.push(`${name}:${sha}`);
    } catch {
      // repo absent or not a git repo
    }
  }
  return parts.join(",") || "none";
}

function fingerprintMemory(root: string): string {
  const memDir = path.join(root, "memory");
  try {
    let latest = 0;
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > latest) latest = mtime;
        }
      }
    }
    walk(memDir);
    return String(latest);
  } catch {
    return "0";
  }
}

function buildFingerprint(
  root: string,
  transcriptDir: string,
): { composite: string; sources: FingerprintSources } {
  const transcripts = fingerprintTranscripts(transcriptDir);
  const repos = fingerprintRepos(root);
  const memory = fingerprintMemory(root);
  return {
    composite: `${transcripts}|${repos}|${memory}`,
    sources: { transcripts, repos, memory },
  };
}

function trimLogTail(lines: string[], line: string): string[] {
  const next = [...lines, line];
  return next.length > LOG_TAIL_LINES ? next.slice(-LOG_TAIL_LINES) : next;
}

export interface IntelJobParams {
  repo: string;
  depth: string;
  focus?: string;
  runId: string;
}

export interface AgentScheduler {
  start(): void;
  stop(): void;
  trigger(): void;
  triggerJob(type: AgentJobType): boolean;
  triggerIntelJob(params: IntelJobParams): string | null;
  cancelJob(jobId: string): boolean;
  cancel(): void;
  getState(): AgentSchedulerState;
}

export function createAgentScheduler(
  root: string,
  transcriptDir: string,
  manager: Manager,
): AgentScheduler {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let cancelRequested = false;
  let currentProc: ChildProcess | null = null;
  let jobs: AgentJob[] = [];
  const jobProcs = new Map<string, ChildProcess>();
  const cancelledJobIds = new Set<string>();
  let lastCheckedAt = "";
  let lastFingerprint = "";
  let fingerprintSources: FingerprintSources = {
    transcripts: "",
    repos: "",
    memory: "",
  };
  const nextRunAt = (): string =>
    new Date(Date.now() + INTERVAL_MS).toISOString();
  let scheduledNextRun = nextRunAt();

  function broadcast(): void {
    manager.onAgentsChanged(getState());
  }

  function pushJob(job: AgentJob): void {
    jobs = [job, ...jobs].slice(0, MAX_JOBS);
  }

  function updateJob(id: string, patch: Partial<AgentJob>): void {
    jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    broadcast();
  }

  interface RunScriptOpts {
    setPipelineProc?: boolean;
    cancelled?: () => boolean;
  }

  function runScript(
    job: AgentJob,
    cmd: string,
    args: string[],
    cwd: string,
    opts: RunScriptOpts = {},
  ): Promise<{ exitCode: number; detail: string }> {
    const setPipelineProc = opts.setPipelineProc ?? true;
    const wasCancelled = opts.cancelled ?? (() => cancelRequested);

    return new Promise((resolve) => {
      const startedAt = new Date().toISOString();
      updateJob(job.id, { status: "running", startedAt });

      const proc = spawn(cmd, args, { cwd, shell: false });
      if (setPipelineProc) currentProc = proc;
      jobProcs.set(job.id, proc);
      let logTail: string[] = [];
      let lastLine = "";

      function onData(chunk: Buffer): void {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((l) => l.trim());
        for (const line of lines) {
          lastLine = line;
          logTail = trimLogTail(logTail, line);
        }
        updateJob(job.id, { logTail });
      }

      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);

      proc.on("close", (code) => {
        if (setPipelineProc) currentProc = null;
        jobProcs.delete(job.id);
        const exitCode = wasCancelled() ? 130 : (code ?? 1);
        const completedAt = new Date().toISOString();
        const durationMs =
          new Date(completedAt).getTime() - new Date(startedAt).getTime();
        const status: AgentJobStatus = wasCancelled()
          ? "cancelled"
          : exitCode === 0
            ? "completed"
            : "failed";
        updateJob(job.id, {
          status,
          completedAt,
          durationMs,
          exitCode,
          logTail,
          detail: lastLine.slice(0, 120) || undefined,
        });
        resolve({ exitCode, detail: lastLine });
      });

      proc.on("error", (err) => {
        if (setPipelineProc) currentProc = null;
        jobProcs.delete(job.id);
        const completedAt = new Date().toISOString();
        const durationMs =
          new Date(completedAt).getTime() - new Date(startedAt).getTime();
        updateJob(job.id, {
          status: "failed",
          completedAt,
          durationMs,
          exitCode: 1,
          detail: err.message,
        });
        resolve({ exitCode: 1, detail: err.message });
      });
    });
  }

  function makeJob(type: AgentJobType, trigger: AgentJobTrigger): AgentJob {
    return {
      id: makeId(),
      type,
      status: "pending",
      trigger,
      queuedAt: new Date().toISOString(),
      logTail: [],
    };
  }

  function skipJob(job: AgentJob, reason: string): void {
    updateJob(job.id, {
      status: "skipped",
      completedAt: new Date().toISOString(),
      durationMs: 0,
      detail: reason,
    });
  }

  const ctxBin = path.join(root, "tools", ".venv", "bin", "ctx");

  function getJobScript(type: AgentJobType): { cmd: string; args: string[] } {
    const s = path.join(root, "tools", "scripts");
    switch (type) {
      case "profile-scan":
        return { cmd: ctxBin, args: ["profiler", "scan"] };
      case "session-analysis":
        return { cmd: ctxBin, args: ["profiler", "analyze", "--limit", "10"] };
      case "codebase-scan":
        return { cmd: ctxBin, args: ["workspace", "scan"] };
      case "memory-synthesis":
        return { cmd: ctxBin, args: ["profiler", "synth", "memory"] };
      case "skill-evolution":
        return {
          cmd: ctxBin,
          args: ["profiler", "synth", "skills", "--top", "5"],
        };
      case "agent-synthesis":
        return {
          cmd: ctxBin,
          args: ["profiler", "synth", "agents", "--top", "5", "--stage"],
        };
      case "knowledge-index":
        return { cmd: ctxBin, args: ["knowledge", "index"] };
      case "intel-analysis":
        return { cmd: path.join(s, "intel-analysis.sh"), args: [] };
    }
  }

  async function runPipeline(trigger: AgentJobTrigger): Promise<void> {
    if (running) return;
    running = true;
    cancelRequested = false;
    broadcast();

    const j1 = makeJob("profile-scan", trigger);
    const j2 = makeJob("session-analysis", trigger);
    const j3 = makeJob("codebase-scan", trigger);
    const j4 = makeJob("memory-synthesis", trigger);
    const j5 = makeJob("skill-evolution", trigger);
    const j6 = makeJob("agent-synthesis", trigger);
    const j7 = makeJob("knowledge-index", trigger);

    pushJob(j7);
    pushJob(j6);
    pushJob(j5);
    pushJob(j4);
    pushJob(j3);
    pushJob(j2);
    pushJob(j1);
    broadcast();

    function skipRemaining(reason: string, ...pending: AgentJob[]): void {
      for (const j of pending) skipJob(j, reason);
    }

    try {
      await runScript(j1, ctxBin, ["profiler", "scan"], root);
      if (cancelRequested) {
        skipRemaining("cancelled", j2, j3, j4, j5, j6, j7);
        return;
      }

      const { exitCode: j2exit } = await runScript(
        j2,
        ctxBin,
        ["profiler", "analyze", "--limit", "10"],
        root,
      );
      if (cancelRequested) {
        skipRemaining("cancelled", j3, j4, j5, j6, j7);
        return;
      }
      if (j2exit !== 0) {
        skipRemaining("session-analysis failed", j3, j4, j5, j6, j7);
        return;
      }

      const reposPresent = KNOWN_REPOS.some((n) =>
        fs.existsSync(path.join(root, "repos", n)),
      );
      if (!reposPresent) {
        skipJob(j3, "no repos present");
      } else {
        await runScript(j3, ctxBin, ["workspace", "scan"], root);
        if (cancelRequested) {
          skipRemaining("cancelled", j4, j5, j6, j7);
          return;
        }
      }

      await runScript(j4, ctxBin, ["profiler", "synth", "memory"], root);
      if (cancelRequested) {
        skipRemaining("cancelled", j5, j6, j7);
        return;
      }

      await runScript(
        j5,
        ctxBin,
        ["profiler", "synth", "skills", "--top", "5"],
        root,
      );
      if (cancelRequested) {
        skipRemaining("cancelled", j6, j7);
        return;
      }

      await runScript(
        j6,
        ctxBin,
        ["profiler", "synth", "agents", "--top", "5", "--stage"],
        root,
      );
      if (cancelRequested) {
        skipRemaining("cancelled", j7);
        return;
      }

      await runScript(j7, ctxBin, ["knowledge", "index"], root);
    } finally {
      running = false;
      cancelRequested = false;
      const post = buildFingerprint(root, transcriptDir);
      lastFingerprint = post.composite;
      fingerprintSources = post.sources;
      scheduledNextRun = nextRunAt();
      broadcast();
    }
  }

  async function tick(): Promise<void> {
    lastCheckedAt = new Date().toISOString();
    const { composite, sources } = buildFingerprint(root, transcriptDir);
    fingerprintSources = sources;

    if (composite === lastFingerprint) {
      scheduledNextRun = nextRunAt();
      broadcast();
      return;
    }

    lastFingerprint = composite;
    await runPipeline("periodic");
  }

  function getState(): AgentSchedulerState {
    return {
      jobs,
      lastCheckedAt,
      lastFingerprint,
      fingerprintSources,
      nextRunAt: scheduledNextRun,
      running,
      intervalMs: INTERVAL_MS,
    };
  }

  return {
    start() {
      tick();
      timer = setInterval(() => {
        tick();
      }, INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    trigger() {
      lastFingerprint = "";
      runPipeline("manual");
    },
    triggerJob(type: AgentJobType): boolean {
      if (running) return false;
      running = true;
      cancelRequested = false;
      broadcast();
      const job = makeJob(type, "manual");
      pushJob(job);
      broadcast();
      const { cmd, args } = getJobScript(type);
      runScript(job, cmd, args, root).finally(() => {
        running = false;
        cancelRequested = false;
        const post = buildFingerprint(root, transcriptDir);
        lastFingerprint = post.composite;
        fingerprintSources = post.sources;
        scheduledNextRun = nextRunAt();
        broadcast();
      });
      return true;
    },
    triggerIntelJob(params: IntelJobParams): string | null {
      const job = makeJob("intel-analysis", "manual");
      job.detail = `${params.repo} (${params.depth})${params.focus ? ` -- ${params.focus}` : ""}`;
      pushJob(job);
      broadcast();
      const s = path.join(root, "tools", "scripts");
      const args = [
        "--repo",
        params.repo,
        "--depth",
        params.depth,
        "--run-id",
        params.runId,
      ];
      if (params.focus) args.push("--focus", params.focus);

      runScript(job, path.join(s, "intel-analysis.sh"), args, root, {
        setPipelineProc: false,
        cancelled: () => cancelledJobIds.has(job.id),
      }).finally(() => {
        cancelledJobIds.delete(job.id);
        broadcast();
      });

      return job.id;
    },
    cancelJob(jobId: string): boolean {
      const proc = jobProcs.get(jobId);
      if (!proc) return false;
      cancelledJobIds.add(jobId);
      proc.kill("SIGTERM");
      return true;
    },
    cancel() {
      if (!running) return;
      cancelRequested = true;
      if (currentProc) {
        currentProc.kill("SIGTERM");
      }
    },
    getState,
  };
}
