import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CTX_BIN, ROOT } from "../paths.js";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 30_000;

interface SearchResult {
  source_path: string;
  doc_type: string;
  heading: string;
  date: string;
  ticket: string;
  repo: string;
  similarity: number;
  text: string;
}

async function runSearch(
  query: string,
  top: number,
  docType?: string,
  repo?: string,
  hybrid?: boolean,
): Promise<SearchResult[]> {
  const args = ["knowledge", "search", query, "--json", "--top", String(top)];
  if (docType) args.push("--type", docType);
  if (repo) args.push("--repo", repo);
  if (hybrid) args.push("--hybrid");

  const { stdout } = await execFileAsync(CTX_BIN, args, {
    cwd: ROOT,
    timeout: TIMEOUT_MS,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  return JSON.parse(stdout) as SearchResult[];
}

export function registerKnowledgeTools(server: McpServer): void {
  server.tool(
    "ctx_knowledge_search",
    "Semantic search across the Context workspace knowledge base: docs, memory, rules, skills, and database schema. Use when you need prior decisions, architecture context, or institutional knowledge.",
    {
      query: z.string().describe("Natural language search query"),
      top: z.number().int().default(10).describe("Max results"),
      doc_type: z
        .enum(["memory", "docs", "rule", "skill", "schema"])
        .optional()
        .describe("Filter by knowledge type"),
      repo: z.string().optional().describe("Filter by repo name"),
      hybrid: z.boolean().default(false).describe("Use hybrid vector + keyword search"),
    },
    async ({ query, top, doc_type, repo, hybrid }) => {
      try {
        const results = await runSearch(query, top, doc_type, repo, hybrid);
        if (results.length === 0) {
          return { content: [{ type: "text" as const, text: "No results. Ensure index exists (run: ctx knowledge index)." }] };
        }

        const lines = results.map((r, i) => {
          const meta = [r.doc_type, r.date, r.repo].filter(Boolean).join(" | ");
          const snippet = r.text.slice(0, 300).replace(/\n/g, " ").trim();
          return `[${i + 1}] ${r.source_path} (${meta}) sim=${r.similarity}${r.heading ? `\n  Section: ${r.heading}` : ""}\n  ${snippet}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Knowledge: "${query}" (${results.length} results)\n\n${lines.join("\n\n")}`,
          }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Knowledge search failed: ${msg}` }] };
      }
    },
  );

  server.tool(
    "ctx_knowledge_read",
    "Read the full content of a document from the Context workspace by path. Use after ctx_knowledge_search to get full text of a result.",
    {
      path: z.string().describe("Relative path from workspace root"),
    },
    async ({ path: relPath }) => {
      const absPath = join(ROOT, relPath);
      if (!absPath.startsWith(ROOT)) {
        return { content: [{ type: "text" as const, text: "Path must be inside workspace." }] };
      }
      try {
        const text = await readFile(absPath, "utf-8");
        return { content: [{ type: "text" as const, text }] };
      } catch {
        return { content: [{ type: "text" as const, text: `Not found: ${relPath}` }] };
      }
    },
  );
}
