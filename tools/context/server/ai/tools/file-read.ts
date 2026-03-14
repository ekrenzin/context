/**
 * File read tool -- reads workspace files with path containment.
 */

import * as fs from "fs";
import * as path from "path";
import { registerTool } from "./index.js";

const DEFAULT_LIMIT = 4000;
const CTX_ROOT = process.env.CTX_ROOT
  ?? path.resolve(import.meta.dirname, "../../../..");

function resolveAndValidate(filePath: string): string | null {
  const resolved = path.resolve(CTX_ROOT, filePath);
  if (!resolved.startsWith(CTX_ROOT)) return null;
  return resolved;
}

registerTool(
  "file_read",
  "Read a file from the workspace. Path is relative to workspace root.",
  {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to workspace root",
      },
      limit: {
        type: "number",
        description: "Max characters to return (default 4000)",
      },
    },
    required: ["path"],
  },
  async (args) => {
    const filePath = String(args.path);
    const limit = Number(args.limit) || DEFAULT_LIMIT;

    const resolved = resolveAndValidate(filePath);
    if (!resolved) {
      return { ok: false, error: "Path is outside the workspace" };
    }

    try {
      const content = fs.readFileSync(resolved, "utf-8");
      return { ok: true, output: content.slice(0, limit) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
