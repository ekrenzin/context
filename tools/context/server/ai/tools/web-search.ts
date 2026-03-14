/**
 * Web search tool -- searches the web via SearXNG or DuckDuckGo fallback.
 * Returns structured results (title, url, snippet).
 */

import { registerTool } from "./index.js";
import { getSetting } from "../../db/index.js";

const TIMEOUT_MS = 10_000;
const DEFAULT_COUNT = 5;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchSearxng(
  query: string,
  count: number,
  baseUrl: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    pageno: "1",
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/search?${params}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`SearXNG returned ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).slice(0, count).map(
      (r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content ?? "",
      }),
    );
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function searchDuckDuckGo(
  query: string,
  count: number,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?${params}`,
      {
        signal: ctrl.signal,
        headers: { "User-Agent": "Context-LocalAI/1.0" },
      },
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
    const html = await res.text();

    const results: SearchResult[] = [];
    const resultPattern =
      /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultPattern.exec(html)) && results.length < count) {
      results.push({
        url: decodeURIComponent(
          match[1].replace(/.*uddg=([^&]*).*/, "$1") || match[1],
        ),
        title: match[2].replace(/<[^>]+>/g, "").trim(),
        snippet: match[3].replace(/<[^>]+>/g, "").trim(),
      });
    }
    return results;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

registerTool(
  "web_search",
  "Search the web and return results with title, URL, and snippet.",
  {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      count: {
        type: "number",
        description: "Number of results to return (default 5)",
      },
    },
    required: ["query"],
  },
  async (args) => {
    const query = String(args.query);
    const count = Number(args.count) || DEFAULT_COUNT;

    if (!query.trim()) {
      return { ok: false, error: "Empty search query" };
    }

    const searxngUrl = getSetting("searxng_url");
    try {
      const results = searxngUrl
        ? await searchSearxng(query, count, searxngUrl)
        : await searchDuckDuckGo(query, count);
      return { ok: true, output: JSON.stringify(results, null, 2) };
    } catch (err) {
      // If SearXNG fails, try DuckDuckGo fallback
      if (searxngUrl) {
        try {
          const results = await searchDuckDuckGo(query, count);
          return { ok: true, output: JSON.stringify(results, null, 2) };
        } catch { /* fall through to error */ }
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
