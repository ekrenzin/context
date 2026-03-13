import { execSync, spawn } from "child_process";
import path from "path";
import type { Manager } from "./manager.js";
import type { UpdateStatus, CommitInfo } from "./types.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface UpdateChecker {
  start(): void;
  stop(): void;
  check(): Promise<UpdateStatus>;
  pull(): Promise<UpdateStatus>;
  getStatus(): UpdateStatus;
}

function git(root: string, args: string): string {
  return execSync(`git -C "${root}" ${args}`, {
    encoding: "utf8",
    timeout: 15_000,
  }).trim();
}

function parseStatusLine(line: string): Pick<UpdateStatus, "ahead" | "behind"> {
  const match = line.match(
    /\[(?:ahead (\d+))?(?:,?\s*)?(?:behind (\d+))?\]/,
  );
  return {
    ahead: match?.[1] ? parseInt(match[1], 10) : 0,
    behind: match?.[2] ? parseInt(match[2], 10) : 0,
  };
}

function isDirty(root: string): boolean {
  const porcelain = git(root, "status --porcelain");
  return porcelain.length > 0;
}

function localBranch(root: string): string {
  return git(root, "rev-parse --abbrev-ref HEAD");
}

function localSha(root: string): string {
  return git(root, "rev-parse --short HEAD");
}

function getCommitMessage(root: string): string {
  try {
    return git(root, "log -1 --format=%s");
  } catch {
    return "";
  }
}

function getCommitHistory(root: string): CommitInfo[] {
  try {
    const raw = git(root, 'log -n 10 --format="%h|%s|%an|%cI"');
    return raw.split("\n").filter(Boolean).map((line) => {
      const parts = line.split("|");
      if (parts.length < 4) return null;
      const [sha, message, author, date] = parts;
      return { sha, message, author, date };
    }).filter((x): x is CommitInfo => x !== null);
  } catch {
    return [];
  }
}

async function runInstall(cwd: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["install", "--no-audit", "--no-fund"], {
      cwd,
      shell: true,
      stdio: "ignore",
    });
    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });
}

function diffIncludesFile(root: string, file: string, behind: number): boolean {
  try {
    const diff = git(root, `diff --name-only HEAD~${behind}..HEAD -- "${file}"`);
    return diff.includes(file);
  } catch {
    return false;
  }
}

export function createUpdateChecker(
  root: string,
  manager: Manager,
): UpdateChecker {
  let timer: ReturnType<typeof setInterval> | null = null;
  let status: UpdateStatus = {
    branch: "unknown",
    sha: "",
    ahead: 0,
    behind: 0,
    dirty: false,
    state: "unknown",
    lastCheckedAt: "",
    autoUpdated: false,
  };

  function broadcast(): void {
    manager.onUpdateStatus(status);
  }

  async function reinstallIfNeeded(wasBehind: number): Promise<void> {
    const changed = diffIncludesFile(
      root,
      "tools/command-center/package.json",
      wasBehind,
    );
    if (changed) {
      await runInstall(path.join(root, "tools", "command-center"));
    }
  }

  async function check(): Promise<UpdateStatus> {
    try {
      git(root, "fetch origin --quiet");
      const sb = git(root, "status -sb");
      const firstLine = sb.split("\n")[0];
      const { ahead, behind } = parseStatusLine(firstLine);
      const dirty = isDirty(root);
      const branch = localBranch(root);
      const sha = localSha(root);
      const commitMessage = getCommitMessage(root);
      const history = getCommitHistory(root);

      let state: UpdateStatus["state"] = "current";
      if (ahead > 0 && behind > 0) state = "diverged";
      else if (behind > 0) state = "behind";
      else if (ahead > 0) state = "ahead";

      status = {
        branch,
        sha,
        commitMessage,
        history,
        ahead,
        behind,
        dirty,
        state,
        lastCheckedAt: new Date().toISOString(),
        autoUpdated: false,
      };

      if (state === "behind" && !dirty) {
        status = await pull();
      } else if (state === "behind" && dirty) {
        status = await stashAndPull();
      }

      broadcast();
      return status;
    } catch (err) {
      status = {
        ...status,
        state: "error",
        lastCheckedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        autoUpdated: false,
      };
      broadcast();
      return status;
    }
  }

  async function pull(): Promise<UpdateStatus> {
    try {
      const wasBehind = status.behind;
      git(root, "pull --ff-only origin main");

      if (wasBehind > 0) await reinstallIfNeeded(wasBehind);

      const sha = localSha(root);
      status = {
        branch: localBranch(root),
        sha,
        commitMessage: getCommitMessage(root),
        history: getCommitHistory(root),
        ahead: 0,
        behind: 0,
        dirty: isDirty(root),
        state: "current",
        lastCheckedAt: new Date().toISOString(),
        autoUpdated: true,
        previousSha: status.sha !== sha ? status.sha : undefined,
      };
      broadcast();
      return status;
    } catch (err) {
      status = {
        ...status,
        state: "error",
        lastCheckedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        autoUpdated: false,
      };
      broadcast();
      return status;
    }
  }

  async function stashAndPull(): Promise<UpdateStatus> {
    const prevSha = status.sha;
    try {
      const stashOut = git(root, 'stash push -m "ctx-auto-update"');
      const didStash = !stashOut.includes("No local changes");

      git(root, "pull --ff-only origin main");

      if (status.behind > 0) await reinstallIfNeeded(status.behind);

      if (didStash) {
        try {
          git(root, "stash pop");
        } catch {
          try { git(root, "checkout -- ."); } catch { /* best-effort */ }
          const sha = localSha(root);
          status = {
            branch: localBranch(root),
            sha,
            commitMessage: getCommitMessage(root),
            history: getCommitHistory(root),
            ahead: 0,
            behind: 0,
            dirty: false,
            state: "current",
            lastCheckedAt: new Date().toISOString(),
            autoUpdated: true,
            stashConflict: true,
            previousSha: prevSha !== sha ? prevSha : undefined,
          };
          broadcast();
          return status;
        }
      }

      const sha = localSha(root);
      status = {
        branch: localBranch(root),
        sha,
        commitMessage: getCommitMessage(root),
        history: getCommitHistory(root),
        ahead: 0,
        behind: 0,
        dirty: isDirty(root),
        state: "current",
        lastCheckedAt: new Date().toISOString(),
        autoUpdated: true,
        previousSha: prevSha !== sha ? prevSha : undefined,
      };
      broadcast();
      return status;
    } catch (err) {
      try { git(root, "stash pop"); } catch { /* stash may not exist */ }
      status = {
        ...status,
        state: "error",
        lastCheckedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        autoUpdated: false,
      };
      broadcast();
      return status;
    }
  }

  return {
    start() {
      check();
      timer = setInterval(() => check(), CHECK_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    check,
    pull,
    getStatus() {
      return status;
    },
  };
}
