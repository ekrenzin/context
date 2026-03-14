import { join, parse } from "node:path";
import { existsSync } from "node:fs";

function findRoot(): string {
  if (process.env.CTX_WORKSPACE) return process.env.CTX_WORKSPACE;

  let dir = process.cwd();
  const { root } = parse(dir);
  while (dir !== root) {
    if (existsSync(join(dir, "workspace.yaml"))) return dir;
    dir = join(dir, "..");
  }
  return process.cwd();
}

export const ROOT = findRoot();
export const MEMORY_DIR = join(ROOT, "memory");
export const TOOLS_DIR = join(ROOT, "tools");
export const CTX_BIN = join(TOOLS_DIR, ".venv", "bin", "ctx");

export const MEMORY_TYPES = [
  "decisions",
  "known-issues",
  "progress",
  "preferences",
  "observations",
  "environment",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
