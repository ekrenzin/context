/**
 * Periodic syncer for external Anthropic community skills.
 *
 * Security model:
 * - Allowlisted remote only -- rejects clones whose origin diverges.
 * - ff-only pulls -- refuses merge commits that could rewrite history.
 * - Skill names validated against strict alphanumeric+hyphen pattern.
 * - Symlinks inside the cloned repo are never followed.
 * - Symlink targets canonicalized and verified to stay inside cache dir.
 * - Stale cleanup only touches links pointing into our cache.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Manager } from "./manager.js";
import type { SkillsSyncStatus } from "./types.js";

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const ALLOWED_REMOTE = "https://github.com/anthropics/skills.git";
const ALLOWED_REMOTE_SSH = "git@github.com:anthropics/skills.git";
const REPO_BRANCH = "main";
const SKILLS_SUBDIR = "skills";
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export interface SkillsSyncer {
  start(): void;
  stop(): void;
  sync(): Promise<SkillsSyncStatus>;
  getStatus(): SkillsSyncStatus;
}

function git(cwd: string, args: string): string {
  return execSync(`git -C "${cwd}" ${args}`, {
    encoding: "utf8",
    timeout: 30_000,
  }).trim();
}

function verifyRemote(cwd: string): void {
  const origin = git(cwd, "remote get-url origin");
  if (origin !== ALLOWED_REMOTE && origin !== ALLOWED_REMOTE_SSH) {
    throw new Error(
      `Remote origin mismatch: got "${origin}", ` +
        `expected "${ALLOWED_REMOTE}". ` +
        "Cache may have been tampered with.",
    );
  }
}

function isSafeName(name: string): boolean {
  return SAFE_NAME.test(name) && !name.includes("..");
}

function resolveTargetDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return path.join(home, ".cursor", "skills-cursor");
}

function availableSkills(cacheDir: string): string[] {
  const skillsRoot = path.join(cacheDir, SKILLS_SUBDIR);
  if (!fs.existsSync(skillsRoot)) return [];

  const realCache = fs.realpathSync(cacheDir);

  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => {
      if (d.isSymbolicLink()) return false;
      if (!d.isDirectory()) return false;
      if (!isSafeName(d.name)) return false;

      const full = path.join(skillsRoot, d.name);
      if (!fs.existsSync(path.join(full, "SKILL.md"))) return false;

      const resolved = fs.realpathSync(full);
      if (!resolved.startsWith(realCache)) return false;

      return true;
    })
    .map((d) => d.name)
    .sort();
}

function cleanStaleSymlinks(
  targetDir: string,
  cacheDir: string,
  managed: Set<string>,
): string[] {
  const removed: string[] = [];
  if (!fs.existsSync(targetDir)) return removed;
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    const fullPath = path.join(targetDir, entry.name);
    const linkTarget = fs.readlinkSync(fullPath);
    if (!linkTarget.startsWith(cacheDir)) continue;
    if (!managed.has(entry.name) || !fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      removed.push(entry.name);
    }
  }
  return removed;
}

export function createSkillsSyncer(
  root: string,
  manager: Manager,
): SkillsSyncer {
  let timer: ReturnType<typeof setInterval> | null = null;
  const cacheDir = path.join(root, ".cache", "anthropic-skills");
  const targetDir = resolveTargetDir();

  let status: SkillsSyncStatus = {
    state: "unknown",
    totalSkills: 0,
    linked: 0,
    skipped: [],
    lastSyncedAt: "",
    cacheDir,
    targetDir,
  };

  function broadcast(): void {
    manager.onSkillsSyncChanged(status);
  }

  function cloneOrPull(): boolean {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      git(
        path.dirname(cacheDir),
        `clone --depth 1 --branch ${REPO_BRANCH} ${ALLOWED_REMOTE} "${cacheDir}"`,
      );
      verifyRemote(cacheDir);
      return true;
    }

    verifyRemote(cacheDir);

    const oldSha = git(cacheDir, "rev-parse HEAD");
    git(cacheDir, "fetch origin --quiet");
    git(cacheDir, `pull --ff-only origin ${REPO_BRANCH}`);
    const newSha = git(cacheDir, "rev-parse HEAD");
    return oldSha !== newSha;
  }

  function linkSkills(): { linked: number; skipped: string[] } {
    const skills = availableSkills(cacheDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const realCache = fs.realpathSync(cacheDir);
    let linked = 0;
    const skipped: string[] = [];

    for (const name of skills) {
      const dest = path.join(targetDir, name);
      const src = path.join(cacheDir, SKILLS_SUBDIR, name);

      const srcResolved = fs.realpathSync(src);
      if (!srcResolved.startsWith(realCache)) {
        skipped.push(name);
        continue;
      }

      const stat = fs.lstatSync(dest, { throwIfNoEntry: false });

      if (stat && !stat.isSymbolicLink()) {
        skipped.push(name);
        continue;
      }

      if (stat?.isSymbolicLink()) {
        const currentTarget = fs.readlinkSync(dest);
        if (currentTarget === src) {
          linked++;
          continue;
        }
        fs.unlinkSync(dest);
      }

      fs.symlinkSync(src, dest);
      linked++;
    }

    cleanStaleSymlinks(targetDir, cacheDir, new Set(skills));
    return { linked, skipped };
  }

  async function sync(): Promise<SkillsSyncStatus> {
    try {
      const updated = cloneOrPull();
      const { linked, skipped } = linkSkills();
      const skills = availableSkills(cacheDir);

      status = {
        state: "current",
        totalSkills: skills.length,
        linked,
        skipped,
        lastSyncedAt: new Date().toISOString(),
        cacheDir,
        targetDir,
        updated,
      };
      broadcast();
      return status;
    } catch (err) {
      status = {
        ...status,
        state: "error",
        lastSyncedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
      broadcast();
      return status;
    }
  }

  return {
    start() {
      sync();
      timer = setInterval(() => sync(), SYNC_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    sync,
    getStatus() {
      return status;
    },
  };
}
