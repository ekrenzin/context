/**
 * Grep tool -- searches file contents within the workspace.
 */

import { execFileSync } from "child_process";
import * as path from "path";
import { registerTool } from "./index.js";

const CTX_ROOT = process.env.CTX_ROOT
  ?? path.resolve(import.meta.dirname, "../../../..");
const MAX_RESULTS = 50;

registerTool(
  "grep",
  "Search file contents in the workspace using a regex pattern.",
  {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: {
        type: "string",
        description: "Directory to search in (relative to workspace root, default: root)",
      },
      glob: {
        type: "string",
        description: "File glob filter (e.g. '*.ts', '*.md')",
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

    const rgArgs = [
      "--no-heading",
      "--line-number",
      "--max-count", String(MAX_RESULTS),
      "--color", "never",
    ];
    if (args.glob) {
      rgArgs.push("--glob", String(args.glob));
    }
    rgArgs.push(pattern, searchPath);

    try {
      const out = execFileSync("rg", rgArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
        maxBuffer: 512 * 1024,
      });
      return { ok: true, output: out.toString().slice(0, 4000) };
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: Buffer };
      if (e.status === 1) {
        return { ok: true, output: "(no matches)" };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
