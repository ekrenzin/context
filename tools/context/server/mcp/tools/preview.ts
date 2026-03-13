import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

type FileType = "image" | "pdf" | "html" | "svg" | "csv" | "json" | "markdown";

interface PreviewEntry {
  id: string;
  path: string;
  filename: string;
  type: FileType;
  title: string;
  url: string;
  timestamp: string;
}

const EXTENSIONS: Record<string, FileType> = {
  ".png": "image", ".jpg": "image", ".jpeg": "image",
  ".gif": "image", ".webp": "image", ".svg": "svg",
  ".pdf": "pdf", ".html": "html", ".htm": "html",
  ".csv": "csv", ".json": "json", ".md": "markdown",
};

const MAX_SIZE = 50 * 1024 * 1024;
const entries: PreviewEntry[] = [];

function validate(filePath: string): { ok: true; type: FileType; size: number; filename: string } | { ok: false; error: string } {
  if (!fs.existsSync(filePath)) return { ok: false, error: `File not found: ${filePath}` };
  const ext = path.extname(filePath).toLowerCase();
  const type = EXTENSIONS[ext];
  if (!type) return { ok: false, error: `Unsupported extension "${ext}". Supported: ${Object.keys(EXTENSIONS).join(", ")}` };
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_SIZE) return { ok: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB` };
  return { ok: true, type, size: stat.size, filename: path.basename(filePath) };
}

function addEntry(filePath: string, type: FileType, filename: string, port: number, title?: string): PreviewEntry {
  const id = randomUUID().slice(0, 8);
  const entry: PreviewEntry = {
    id, path: filePath, filename, type,
    title: title ?? filename,
    url: `http://127.0.0.1:${port}/api/preview/files/${id}/${encodeURIComponent(filename)}`,
    timestamp: new Date().toISOString(),
  };
  entries.push(entry);
  return entry;
}

export function register(server: McpServer, deps: McpDeps): void {
  const port = parseInt(process.env.CTX_DASHBOARD_PORT ?? "19470", 10);

  server.tool(
    "preview",
    "Open a file preview in the Command Center browser UI. Supports images, SVG, PDF, HTML, CSV, JSON, Markdown.",
    {
      path: z.string().describe("Absolute path to the file to preview"),
      title: z.string().optional().describe("Optional label shown in the preview UI"),
    },
    async ({ path: filePath, title }) => {
      const result = validate(filePath);
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: result.error }], isError: true };
      }

      const entry = addEntry(filePath, result.type, result.filename, port, title);
      deps.mqttClient.publish("ctx/preview/opened", entry);

      return {
        content: [{
          type: "text" as const,
          text: `Opened preview: ${entry.title} (${result.type}, ${(result.size / 1024).toFixed(1)}KB)\nURL: ${entry.url}\nView: http://127.0.0.1:${port}/previews`,
        }],
      };
    },
  );

  server.tool(
    "preview_gallery",
    "Open a gallery of files in the Command Center browser UI.",
    {
      files: z.array(z.object({
        path: z.string().describe("Absolute path to the file"),
        title: z.string().optional().describe("Optional label for this file"),
      })).describe("Array of files to preview"),
      gallery_title: z.string().optional().describe("Title for the gallery view"),
    },
    async ({ files, gallery_title }) => {
      const results: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const result = validate(file.path);
        if (!result.ok) { errors.push(`${file.path}: ${result.error}`); continue; }
        const entry = addEntry(file.path, result.type, result.filename, port, file.title);
        deps.mqttClient.publish("ctx/preview/opened", entry);
        results.push(`${entry.title} (${result.type})`);
      }

      const lines: string[] = [];
      if (gallery_title) lines.push(`Gallery: ${gallery_title}`);
      lines.push(`Opened ${results.length} file(s): ${results.join(", ")}`);
      if (errors.length > 0) lines.push(`Errors: ${errors.join("; ")}`);
      lines.push(`View: http://127.0.0.1:${port}/previews`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        isError: errors.length > 0 && results.length === 0,
      };
    },
  );
}

export function getEntries(): PreviewEntry[] {
  return entries;
}
