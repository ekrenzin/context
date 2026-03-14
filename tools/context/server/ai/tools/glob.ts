/**
 * Glob tool -- finds files by pattern within the workspace.
 */

import { execFileSync } from "child_process";
import * as path from "path";
import { registerTool } from "./index.js";

const CTX_ROOT = process.env.CTX_ROOT
  ?? path.resolve(import.meta.dirname, "../../../..");
const MAX_RESULTS = 100;

registerTool(
  "glob",
  "Find files matching a glob pattern in the workspace.",
  {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.md')",
      },
      path: {
        type: "string",
        description: "Directory to search in (relative to workspace root, default: root)",
      },
    },
    required: ["pattern"],
  },
  async (args) => {
    const pattern = String(args.pattern);
    const searchPath = args.path
      ? path.resolve(CTX_ROOT, String(args.path))
      : CTX_ROOT;

    if (!searchPath.startsWith(CTX_ROOT)) {
      return { ok: false, error: "Path is outside the workspace" };
    }

    try {
      const out = execFileSync("find", [searchPath, "-name", pattern, "-type", "f"], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
        maxBuffer: 512 * 1024,
      });
      const files = out.toString().trim().split("\n").filter(Boolean);
      const relative = files
        .slice(0, MAX_RESULTS)
        .map((f) => path.relative(CTX_ROOT, f));
      return { ok: true, output: relative.join("\n") || "(no matches)" };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
