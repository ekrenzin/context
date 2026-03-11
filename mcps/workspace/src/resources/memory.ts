import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MEMORY_DIR, ROOT } from "../paths.js";

export function registerMemoryResources(server: McpServer): void {
  server.resource(
    "memory-index",
    "memory://entries",
    { description: "Index of all memory entries across all types" },
    async () => {
      const lines: string[] = [];
      let dirs: string[];
      try {
        dirs = await readdir(MEMORY_DIR);
      } catch {
        dirs = [];
      }

      for (const dirName of dirs.sort()) {
        if (dirName.startsWith(".")) continue;
        const typeDir = join(MEMORY_DIR, dirName);
        let files: string[];
        try {
          files = await readdir(typeDir);
        } catch {
          continue;
        }
        for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
          lines.push(`${dirName}/${file}`);
        }
      }

      return {
        contents: [{
          uri: "memory://entries",
          text: lines.length > 0
            ? lines.join("\n")
            : "No memory entries found.",
          mimeType: "text/plain",
        }],
      };
    },
  );

  server.resource(
    "memory-file",
    "memory://entries/{type}/{filename}",
    { description: "Read a specific memory file by type and filename" },
    async (uri) => {
      const pathParts = uri.pathname.replace(/^\/\/entries\//, "").split("/");
      if (pathParts.length < 2) {
        return { contents: [{ uri: uri.href, text: "Invalid path", mimeType: "text/plain" }] };
      }

      const filePath = join(MEMORY_DIR, ...pathParts);
      if (!filePath.startsWith(MEMORY_DIR)) {
        return { contents: [{ uri: uri.href, text: "Invalid path", mimeType: "text/plain" }] };
      }

      try {
        const text = await readFile(filePath, "utf-8");
        return { contents: [{ uri: uri.href, text, mimeType: "text/markdown" }] };
      } catch {
        return {
          contents: [{
            uri: uri.href,
            text: `File not found: ${relative(ROOT, filePath)}`,
            mimeType: "text/plain",
          }],
        };
      }
    },
  );
}
