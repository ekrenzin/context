import { z } from "zod";
import fs from "fs";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_write_file",
    "Write content to a file. Creates parent directories if needed. Overwrites existing files.",
    {
      path: z.string().describe("Relative or absolute file path"),
      content: z.string().describe("File content to write"),
    },
    async ({ path: filePath, content }) => {
      const abs = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
      const dir = path.dirname(abs);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
      const bytes = Buffer.byteLength(content, "utf-8");
      return {
        content: [{ type: "text" as const, text: `Wrote ${bytes} bytes to ${abs}` }],
      };
    },
  );

  server.tool(
    "cc_append_file",
    "Append content to an existing file, or create it if it does not exist.",
    {
      path: z.string().describe("Relative or absolute file path"),
      content: z.string().describe("Content to append"),
    },
    async ({ path: filePath, content }) => {
      const abs = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
      const dir = path.dirname(abs);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(abs, content, "utf-8");
      return {
        content: [{ type: "text" as const, text: `Appended ${Buffer.byteLength(content, "utf-8")} bytes to ${abs}` }],
      };
    },
  );
}
