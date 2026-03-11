import { execFile } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KNOWLEDGE_VENV, MEMORY_DIR, MEMORY_TYPES, ROOT, type MemoryType } from "../paths.js";

const execFileAsync = promisify(execFile);

const FM_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const KV_RE = /^(\w[\w-]*):\s*(.+)$/gm;

interface MemoryEntry {
  path: string;
  type: string;
  title: string;
  date: string;
  ticket: string;
  repo: string;
  summary: string;
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = FM_RE.exec(text);
  if (!match) return {};
  const kvs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  KV_RE.lastIndex = 0;
  while ((m = KV_RE.exec(match[1])) !== null) {
    kvs[m[1]] = m[2].trim();
  }
  return kvs;
}

function extractSummary(text: string, max = 200): string {
  const body = text.replace(FM_RE, "").trim();
  for (const line of body.split("\n")) {
    const stripped = line.trim().replace(/^[-*]\s*/, "");
    if (!stripped || stripped.startsWith("#")) continue;
    if (stripped.length > 20) {
      return stripped.length > max ? stripped.slice(0, max) + "..." : stripped;
    }
  }
  return "(no summary)";
}

async function discoverEntries(
  typeFilter?: string,
  days?: number,
): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];
  let dirs: string[];
  try {
    dirs = await readdir(MEMORY_DIR);
  } catch {
    return entries;
  }

  const cutoff = days
    ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    : null;

  for (const dirName of dirs) {
    if (typeFilter && dirName !== typeFilter) continue;
    if (dirName.startsWith(".")) continue;

    const typeDir = join(MEMORY_DIR, dirName);
    let files: string[];
    try {
      files = await readdir(typeDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        const filePath = join(typeDir, file);
        const text = await readFile(filePath, "utf-8");
        const fm = parseFrontmatter(text);
        const date = fm.date ?? "";
        if (cutoff && date < cutoff) continue;

        entries.push({
          path: relative(ROOT, filePath),
          type: dirName,
          title: fm.title ?? file.replace(/-/g, " ").replace(/\.md$/, ""),
          date,
          ticket: fm.ticket ?? "",
          repo: fm.repo ?? "",
          summary: extractSummary(text),
        });
      } catch { /* skip unreadable */ }
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

function scoreEntry(
  e: MemoryEntry,
  ticket: string,
  repo: string,
  query: string,
): number {
  let score = 0;
  if (ticket && e.ticket.toUpperCase() === ticket.toUpperCase()) score += 50;
  if (repo && e.repo.toLowerCase().includes(repo.toLowerCase())) score += 30;

  const now = new Date();
  const entryDate = new Date(e.date || "1970-01-01");
  const daysOld = Math.max(
    Math.floor((now.getTime() - entryDate.getTime()) / 86400000),
    0,
  );
  if (daysOld <= 7) score += Math.max(10 - daysOld, 1);

  if (query) {
    const haystack = `${e.title} ${e.summary}`.toLowerCase();
    for (const kw of query.toLowerCase().split(/\s+/)) {
      if (haystack.includes(kw)) score += 5;
    }
  }

  if (score === 0) score = Math.max(1, 5 - daysOld);
  return score;
}

async function autoIndexFile(relPath: string): Promise<string> {
  try {
    await execFileAsync(KNOWLEDGE_VENV, ["knowledge", "index-file", relPath], {
      cwd: ROOT,
      timeout: 30_000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    return "\n[knowledge] Auto-indexed into vector DB.";
  } catch {
    return "";
  }
}

export function registerMemoryTools(server: McpServer): void {
  server.tool(
    "memory_scan",
    "Search agent memory for relevant entries. Returns scored results.",
    {
      ticket: z.string().optional().describe("Ticket ID to boost"),
      repo: z.string().optional().describe("Repo name to boost"),
      query: z.string().optional().describe("Free-text keywords"),
      days: z.number().int().optional().describe("Only entries from last N days"),
      top: z.number().int().default(10).describe("Max results"),
    },
    async ({ ticket, repo, query, days, top }) => {
      const entries = await discoverEntries(undefined, days);
      if (entries.length === 0) {
        return { content: [{ type: "text", text: "No memory entries found." }] };
      }

      const scored = entries
        .map((e) => ({ score: scoreEntry(e, ticket ?? "", repo ?? "", query ?? ""), entry: e }))
        .sort((a, b) => b.score - a.score)
        .slice(0, top);

      const lines = scored.map(
        ({ score, entry: e }) =>
          `[${score}] ${e.path} (${e.date})${e.ticket ? ` [${e.ticket}]` : ""}\n  ${e.summary}`,
      );

      return {
        content: [{
          type: "text",
          text: `Memory Scan (${scored.length} shown / ${entries.length} total)\n\n${lines.join("\n\n")}`,
        }],
      };
    },
  );

  server.tool(
    "memory_read",
    "Read the full content of a specific memory file",
    { path: z.string().describe("Relative path from repo root (e.g. memory/decisions/foo.md)") },
    async ({ path: relPath }) => {
      const absPath = join(ROOT, relPath);
      if (!absPath.startsWith(MEMORY_DIR)) {
        return { content: [{ type: "text", text: "Path must be inside memory/ directory." }] };
      }
      try {
        const text = await readFile(absPath, "utf-8");
        return { content: [{ type: "text", text }] };
      } catch {
        return { content: [{ type: "text", text: `File not found: ${relPath}` }] };
      }
    },
  );

  server.tool(
    "memory_write",
    "Write a memory entry with YAML frontmatter",
    {
      type: z.enum(MEMORY_TYPES).describe("Memory category"),
      title: z.string().describe("Entry title"),
      body: z.string().describe("Markdown body content"),
      ticket: z.string().optional().describe("Ticket ID"),
      repo: z.string().optional().describe("Repository name"),
    },
    async ({ type, title, body, ticket, repo }) => {
      const date = new Date().toISOString().slice(0, 10);
      const fmLines = ["---", `title: ${title}`, `date: ${date}`];
      if (ticket) fmLines.push(`ticket: ${ticket}`);
      if (repo) fmLines.push(`repo: ${repo}`);
      if (type === "progress") fmLines.push("status: in-progress");
      else if (type === "decisions") fmLines.push("status: accepted");
      fmLines.push("---");

      const content = `${fmLines.join("\n")}\n\n${body.trimStart()}`;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80).replace(/-$/, "");
      const filename = `${slug || "untitled"}.md`;
      const target = join(MEMORY_DIR, type, filename);

      await mkdir(join(MEMORY_DIR, type), { recursive: true });
      await writeFile(target, content, "utf-8");

      const relPath = relative(ROOT, target);
      const indexMsg = await autoIndexFile(relPath);
      return { content: [{ type: "text", text: `Written: ${relPath}${indexMsg}` }] };
    },
  );

  server.tool(
    "memory_list",
    "List memory entries, optionally filtered by type and recency",
    {
      type: z.enum(MEMORY_TYPES).optional().describe("Filter by category"),
      days: z.number().int().optional().describe("Only entries from last N days"),
    },
    async ({ type, days }) => {
      const entries = await discoverEntries(type, days);
      if (entries.length === 0) {
        return { content: [{ type: "text", text: "No memory entries found." }] };
      }

      const header = `Type             Date         Title                                    Path`;
      const sep = `----             ----         -----                                    ----`;
      const rows = entries.map((e) => {
        const t = e.title.length > 38 ? e.title.slice(0, 36) + ".." : e.title;
        return `${e.type.padEnd(16)} ${e.date.padEnd(12)} ${t.padEnd(40)} ${e.path}`;
      });

      return {
        content: [{ type: "text", text: `Memory Files (${entries.length})\n\n${header}\n${sep}\n${rows.join("\n")}` }],
      };
    },
  );
}
