import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KNOWLEDGE_VENV, ROOT } from "../paths.js";

const execFileAsync = promisify(execFile);

const SEARCH_TIMEOUT_MS = 30_000;

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

  try {
    const { stdout } = await execFileAsync(KNOWLEDGE_VENV, args, {
      cwd: ROOT,
      timeout: SEARCH_TIMEOUT_MS,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    return JSON.parse(stdout) as SearchResult[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("knowledge dependencies not installed")) {
      throw new Error("Knowledge dependencies not installed. Run: pip install ctx-tools[knowledge]");
    }
    throw new Error(`Knowledge search failed: ${msg}`);
  }
}

function formatResults(results: SearchResult[], query: string): string {
  if (results.length === 0) {
    return "No results found. Ensure the index exists (run `ctx knowledge index`).";
  }

  const lines = results.map((r, i) => {
    const heading = r.heading ? `\n  Section: ${r.heading}` : "";
    const meta = [r.doc_type, r.date, r.repo].filter(Boolean).join(" | ");
    const snippet = r.text.slice(0, 300).replace(/\n/g, " ").trim();
    return `[${i + 1}] ${r.source_path} (${meta}) -- similarity: ${r.similarity}${heading}\n  ${snippet}`;
  });

  return `Knowledge Search: "${query}" (${results.length} results)\n\n${lines.join("\n\n")}`;
}

export function registerKnowledgeTools(server: McpServer): void {
  server.tool(
    "knowledge_search",
    "Semantic search across the knowledge base (docs, memory, rules, skills, DB schema). Use when you need to find relevant context, prior decisions, or institutional knowledge.",
    {
      query: z.string().describe("Natural language search query"),
      top: z.number().int().default(10).describe("Max results to return"),
      doc_type: z
        .enum(["memory", "docs", "rule", "skill", "schema"])
        .optional()
        .describe("Filter results to a specific knowledge type"),
      repo: z.string().optional().describe("Filter by repo name mentioned in metadata"),
      hybrid: z.boolean().default(false).describe("Use hybrid vector + keyword search for better recall"),
    },
    async ({ query, top, doc_type, repo, hybrid }) => {
      const results = await runSearch(query, top, doc_type, repo, hybrid);
      return {
        content: [{ type: "text", text: formatResults(results, query) }],
      };
    },
  );

  server.tool(
    "knowledge_context",
    "Read the full content of a knowledge base document by path. Use after knowledge_search to get the complete text of a relevant result.",
    {
      path: z.string().describe("Relative path from workspace root (from knowledge_search results)"),
    },
    async ({ path: relPath }) => {
      const absPath = join(ROOT, relPath);
      if (!absPath.startsWith(ROOT)) {
        return { content: [{ type: "text", text: "Path must be inside workspace." }] };
      }
      try {
        const text = await readFile(absPath, "utf-8");
        return { content: [{ type: "text", text }] };
      } catch {
        return { content: [{ type: "text", text: `File not found: ${relPath}` }] };
      }
    },
  );
}
