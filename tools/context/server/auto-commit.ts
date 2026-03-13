/**
 * Two-phase auto-commit service:
 *   1. Local save (30s) -- git add -A && commit with timestamp. No push.
 *   2. Push cycle (30m) -- squash unpushed commits, AI-name, push to main.
 */

import { execSync } from "child_process";
import type { CtxMqttClient } from "ctx-mqtt";
import { complete } from "./ai/client.js";

const SAVE_INTERVAL_MS = 30_000;
const PUSH_INTERVAL_MS = 30 * 60 * 1000;
const TOPIC = "ctx/auto-commit/status";

export interface AutoCommitStatus {
  save: {
    lastAt: string;
    commits: number;
  };
  push: {
    state: "idle" | "running" | "disabled";
    lastRunAt: string;
    lastResult: "success" | "skipped" | "error" | "none";
    lastMessage: string;
    lastCommitSha: string;
    nextRunAt: string;
  };
}

export interface AutoCommitService {
  start(): void;
  stop(): void;
  trigger(): void;
  getStatus(): AutoCommitStatus;
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

function hasDirtyTree(cwd: string): boolean {
  try {
    const out = git("status --porcelain", cwd);
    return out.length > 0;
  } catch {
    return false;
  }
}

function hasUnpushedCommits(cwd: string): boolean {
  try {
    const count = git("rev-list --count @{u}..HEAD", cwd);
    return parseInt(count, 10) > 0;
  } catch {
    return false;
  }
}

function getSquashedDiff(cwd: string): string {
  try {
    return git("diff @{u}..HEAD", cwd);
  } catch {
    return "";
  }
}

function getUnpushedLog(cwd: string): string {
  try {
    return git("log --oneline @{u}..HEAD", cwd);
  } catch {
    return "";
  }
}

async function generateCommitMessage(
  diff: string,
  log: string,
): Promise<string> {
  const truncated = diff.slice(0, 12_000);

  const prompt = [
    "Generate a concise git commit message for the following squashed changes.",
    "Short subject line (max 72 chars), optionally bullet-point body.",
    "Reply with ONLY the commit message, no markdown fencing.",
    "",
    "Individual commits being squashed:",
    log,
    "",
    "Combined diff (truncated):",
    truncated,
  ].join("\n");

  const res = await complete({
    prompt,
    system: "You write concise, conventional git commit messages. No emojis.",
    maxTokens: 300,
    temperature: 0.3,
  });

  return res.text.trim();
}

export function createAutoCommit(
  root: string,
  mqtt: CtxMqttClient,
): AutoCommitService {
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let pushTimer: ReturnType<typeof setInterval> | null = null;
  let pushing = false;
  let saveCount = 0;

  const status: AutoCommitStatus = {
    save: { lastAt: "", commits: 0 },
    push: {
      state: "idle",
      lastRunAt: "",
      lastResult: "none",
      lastMessage: "",
      lastCommitSha: "",
      nextRunAt: "",
    },
  };

  function publish(): void {
    mqtt.publish(TOPIC, status, true);
  }

  // ── Phase 1: local save every 30s ────────────────────────────────

  function save(): void {
    if (pushing) return;
    if (!hasDirtyTree(root)) return;

    try {
      git("add -A", root);
      const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
      git(`commit -m "auto-save ${ts}"`, root);
      saveCount++;
      status.save.lastAt = new Date().toISOString();
      status.save.commits = saveCount;
      publish();
    } catch {
      // commit can fail if nothing staged after add (e.g. only ignored files)
    }
  }

  // ── Phase 2: squash + AI name + push every 30m ───────────────────

  async function push(): Promise<void> {
    if (pushing) return;
    pushing = true;
    status.push.state = "running";
    status.push.lastRunAt = new Date().toISOString();
    publish();

    try {
      // Commit any remaining dirty state first
      save();

      if (!hasUnpushedCommits(root)) {
        status.push.lastResult = "skipped";
        status.push.lastMessage = "no unpushed commits";
        return;
      }

      const diff = getSquashedDiff(root);
      const log = getUnpushedLog(root);

      if (!diff) {
        status.push.lastResult = "skipped";
        status.push.lastMessage = "empty diff";
        return;
      }

      try {
        git("fetch origin main --quiet", root);
      } catch {
        status.push.lastResult = "error";
        status.push.lastMessage = "fetch failed";
        return;
      }

      // Rebase if behind
      const behind = git("rev-list --count HEAD..@{u}", root);
      if (parseInt(behind, 10) > 0) {
        try {
          git("rebase origin/main", root);
        } catch {
          git("rebase --abort", root);
          status.push.lastResult = "error";
          status.push.lastMessage = "rebase conflict -- skipping push";
          return;
        }
      }

      const message = await generateCommitMessage(diff, log);

      // Squash all unpushed into one commit
      const upstream = git("rev-parse @{u}", root);
      git("reset --soft " + upstream, root);
      git("commit -m " + JSON.stringify(message), root);
      git("push origin main", root);

      const sha = git("rev-parse --short HEAD", root);
      saveCount = 0;
      status.save.commits = 0;
      status.push.lastResult = "success";
      status.push.lastMessage = message.split("\n")[0].slice(0, 120);
      status.push.lastCommitSha = sha;
    } catch (err) {
      status.push.lastResult = "error";
      status.push.lastMessage =
        err instanceof Error ? err.message : String(err);
    } finally {
      pushing = false;
      status.push.state = "idle";
      status.push.nextRunAt =
        new Date(Date.now() + PUSH_INTERVAL_MS).toISOString();
      publish();
    }
  }

  return {
    start() {
      status.push.nextRunAt =
        new Date(Date.now() + PUSH_INTERVAL_MS).toISOString();
      publish();
      saveTimer = setInterval(save, SAVE_INTERVAL_MS);
      pushTimer = setInterval(() => { push(); }, PUSH_INTERVAL_MS);
      console.log("[auto-commit] started (save: 30s, push: 30m)");
    },
    stop() {
      if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
      if (pushTimer) { clearInterval(pushTimer); pushTimer = null; }
      status.push.state = "disabled";
      publish();
    },
    trigger() {
      push();
    },
    getStatus() {
      return JSON.parse(JSON.stringify(status));
    },
  };
}
