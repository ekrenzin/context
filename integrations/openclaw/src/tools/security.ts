import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CTX_BIN, ROOT } from "../paths.js";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 120_000;

export function registerSecurityTools(server: McpServer): void {
  server.tool(
    "ctx_security_scan",
    "Run a CVE security scan on a repository in the Context workspace. Checks dependencies for known vulnerabilities.",
    {
      repo: z.string().optional().describe("Repo name to scan. Omit for all repos."),
    },
    async ({ repo }) => {
      const args = ["security", "scan"];
      if (repo) args.push("--repo", repo);

      try {
        const { stdout, stderr } = await execFileAsync(CTX_BIN, args, {
          cwd: ROOT,
          timeout: TIMEOUT_MS,
          env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        });
        return { content: [{ type: "text" as const, text: stdout + (stderr ? `\n${stderr}` : "") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Security scan failed:\n${msg}` }] };
      }
    },
  );

  server.tool(
    "ctx_security_patch",
    "Auto-upgrade vulnerable dependencies in a Context workspace repo. Applies safe patches for known CVEs.",
    {
      repo: z.string().describe("Repo name to patch"),
      dry_run: z.boolean().default(true).describe("Preview changes without applying (default: true)"),
    },
    async ({ repo, dry_run }) => {
      const args = ["security", "patch", "--repo", repo];
      if (dry_run) args.push("--dry-run");

      try {
        const { stdout, stderr } = await execFileAsync(CTX_BIN, args, {
          cwd: ROOT,
          timeout: TIMEOUT_MS,
          env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        });
        return { content: [{ type: "text" as const, text: stdout + (stderr ? `\n${stderr}` : "") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Patch failed:\n${msg}` }] };
      }
    },
  );
}
