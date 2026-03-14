import { join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Resolve the Context workspace root. Checks:
 * 1. CTX_WORKSPACE env var (explicit override)
 * 2. Walk up from cwd looking for workspace.yaml
 * 3. Fall back to cwd
 */
function findRoot(): string {
  if (process.env.CTX_WORKSPACE) return process.env.CTX_WORKSPACE;

  let dir = process.cwd();
  const { root } = require("node:path").parse(dir);
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
