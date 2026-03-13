#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveFile, createPreviewEntry, ensureServer, openBrowser, stopServer } from "./http.js";
import { clear } from "./store.js";

const server = new McpServer({
  name: "file-preview",
  version: "0.1.0",
});

server.tool(
  "preview",
  "Open a file preview in the user's browser. Supports images (PNG, JPG, GIF, WebP), SVG, PDF, HTML, CSV, JSON, and Markdown.",
  {
    path: z.string().describe("Absolute path to the file to preview"),
    title: z.string().optional().describe("Optional label shown in the preview UI"),
  },
  async ({ path: filePath, title }) => {
    const result = resolveFile(filePath);
    if (!result.ok) {
      return { content: [{ type: "text" as const, text: result.error }], isError: true };
    }

    const baseUrl = await ensureServer();
    const entry = createPreviewEntry(filePath, result.type, result.filename, title);
    await openBrowser(baseUrl);

    return {
      content: [{
        type: "text" as const,
        text: `Opened preview: ${entry.title} (${result.type}, ${(result.size / 1024).toFixed(1)}KB)\nURL: ${entry.url}`,
      }],
    };
  },
);

server.tool(
  "preview_gallery",
  "Open a gallery of files in the user's browser. Each file gets a thumbnail in the sidebar.",
  {
    files: z.array(z.object({
      path: z.string().describe("Absolute path to the file"),
      title: z.string().optional().describe("Optional label for this file"),
    })).describe("Array of files to preview"),
    gallery_title: z.string().optional().describe("Title for the gallery view"),
  },
  async ({ files, gallery_title }) => {
    const baseUrl = await ensureServer();
    const results: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const result = resolveFile(file.path);
      if (!result.ok) {
        errors.push(`${file.path}: ${result.error}`);
        continue;
      }
      const entry = createPreviewEntry(file.path, result.type, result.filename, file.title);
      results.push(`${entry.title} (${result.type})`);
    }

    await openBrowser(baseUrl);

    const lines: string[] = [];
    if (gallery_title) lines.push(`Gallery: ${gallery_title}`);
    lines.push(`Opened ${results.length} file(s): ${results.join(", ")}`);
    if (errors.length > 0) lines.push(`Errors: ${errors.join("; ")}`);

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
      isError: errors.length > 0 && results.length === 0,
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[file-preview-mcp] server started on stdio");

  process.on("SIGINT", () => {
    clear();
    stopServer();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    clear();
    stopServer();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
