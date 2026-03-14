import { z } from "zod";
import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

const MAX_READ = 256 * 1024;
const IGNORED = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "dist", "build", ".DS_Store",
]);

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_read_file",
    "Read the contents of a file in the workspace",
    {
      path: z.string().describe("Relative or absolute file path"),
    },
    async ({ path: filePath }) => {
      const abs = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
      if (!fs.existsSync(abs)) {
        return { content: [{ type: "text" as const, text: `File not found: ${filePath}` }], isError: true };
      }
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        return { content: [{ type: "text" as const, text: `Path is a directory: ${filePath}` }], isError: true };
      }
      const truncated = stat.size > MAX_READ;
      const buf = Buffer.alloc(Math.min(stat.size, MAX_READ));
      const fd = fs.openSync(abs, "r");
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      const suffix = truncated ? `\n\n[truncated -- ${stat.size} bytes total]` : "";
      return { content: [{ type: "text" as const, text: buf.toString("utf-8") + suffix }] };
    },
  );

  server.tool(
    "cc_browse_dir",
    "List files and directories in a workspace path",
    {
      path: z.string().default(".").describe("Relative or absolute directory path"),
    },
    async ({ path: dirPath }) => {
      const abs = dirPath === "." ? root : path.isAbsolute(dirPath) ? dirPath : path.resolve(root, dirPath);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        return { content: [{ type: "text" as const, text: `Not a directory: ${dirPath}` }], isError: true };
      }
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => !IGNORED.has(e.name))
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => `${e.isDirectory() ? "[dir]" : "     "} ${e.name}`);
      return { content: [{ type: "text" as const, text: entries.join("\n") || "(empty)" }] };
    },
  );
}
