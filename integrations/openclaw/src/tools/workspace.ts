import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CTX_BIN, ROOT } from "../paths.js";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 120_000;

async function runCtx(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync(CTX_BIN, args, {
    cwd: ROOT,
    timeout: TIMEOUT_MS,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  return stdout + (stderr ? `\n${stderr}` : "");
}

export function registerWorkspaceTools(server: McpServer): void {
  server.tool(
    "ctx_workspace_check",
    "Run quality checks (lint, types, tests) on a repo in the Context workspace. Catches errors before they ship.",
    {
      repo: z.string().optional().describe("Repo name to check. Omit for root."),
      quick: z.boolean().default(false).describe("Quick mode: lint + types only, skip tests"),
    },
    async ({ repo, quick }) => {
      const args = ["workspace", "check"];
      if (quick) args.push("--quick");
      if (repo) args.push("--repo", repo);
      else args.push("--root");

      try {
        const output = await runCtx(args);
        return { content: [{ type: "text" as const, text: output || "All checks passed." }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Check failed:\n${msg}` }] };
      }
    },
  );

  server.tool(
    "ctx_workspace_verify",
    "Validate that the Context workspace is set up correctly without modifying anything. Read-only health check.",
    {},
    async () => {
      try {
        const output = await runCtx(["workspace", "verify"]);
        return { content: [{ type: "text" as const, text: output || "Workspace verified." }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Verification failed:\n${msg}` }] };
      }
    },
  );

  server.tool(
    "ctx_workspace_status",
    "Get the current status of the Context workspace: config, repos, and services.",
    {},
    async () => {
      const parts: string[] = [];

      try {
        const config = await readFile(join(ROOT, "workspace.yaml"), "utf-8");
        parts.push(`=== workspace.yaml ===\n${config}`);
      } catch {
        parts.push("workspace.yaml: not found");
      }

      try {
        const repos = await readFile(join(ROOT, "repos.yaml"), "utf-8");
        parts.push(`=== repos.yaml ===\n${repos}`);
      } catch {
        parts.push("repos.yaml: not found");
      }

      try {
        const output = await runCtx(["workspace", "verify"]);
        parts.push(`=== verify ===\n${output}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        parts.push(`=== verify ===\n${msg}`);
      }

      return { content: [{ type: "text" as const, text: parts.join("\n\n") }] };
    },
  );
}
