import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(__dirname, "..", "..", "..");
export const MEMORY_DIR = join(ROOT, "memory");
export const OUTPUT_DIR = join(ROOT, "playground", "output");
export const TOOLS_DIR = join(ROOT, "tools");
export const KNOWLEDGE_VENV = join(ROOT, "tools", ".venv", "bin", "ctx");

export const MEMORY_TYPES = [
  "decisions",
  "known-issues",
  "progress",
  "preferences",
  "observations",
  "environment",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
