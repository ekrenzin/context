import { z } from "zod";
import { execFile } from "child_process";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

const DEFAULT_TIMEOUT = 30_000;
const MAX_OUTPUT = 128 * 1024;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n\n[truncated -- ${str.length} chars total]`;
}

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_run_command",
    "Execute a shell command and return its output. Runs in the workspace root by default.",
    {
      command: z.string().describe("The command to run (passed to /bin/sh -c)"),
      cwd: z.string().optional().describe("Working directory (relative to workspace root or absolute)"),
      timeout: z.number().optional().describe("Timeout in milliseconds (default 30000)"),
    },
    async ({ command, cwd, timeout }) => {
      const workdir = cwd
        ? path.isAbsolute(cwd) ? cwd : path.resolve(root, cwd)
        : root;
      const ms = timeout ?? DEFAULT_TIMEOUT;

      return new Promise((resolve) => {
        execFile("/bin/sh", ["-c", command], {
          cwd: workdir,
          timeout: ms,
          maxBuffer: MAX_OUTPUT,
          env: { ...process.env, HOME: process.env.HOME },
        }, (err, stdout, stderr) => {
          const exitCode = err && "code" in err ? (err as { code: number }).code : (err ? 1 : 0);
          const parts: string[] = [];

          if (stdout) parts.push(truncate(stdout, MAX_OUTPUT));
          if (stderr) parts.push(`[stderr]\n${truncate(stderr, MAX_OUTPUT)}`);
          if (err && !stdout && !stderr) parts.push(`Error: ${err.message}`);

          parts.push(`\n[exit code: ${exitCode}]`);

          resolve({
            content: [{ type: "text" as const, text: parts.join("\n") }],
            isError: exitCode !== 0,
          });
        });
      });
    },
  );
}
