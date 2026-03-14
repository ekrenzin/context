/**
 * Web fetch tool -- retrieves a URL and returns its text content.
 * Strips HTML tags by default for cleaner model consumption.
 */

import { registerTool } from "./index.js";

const TIMEOUT_MS = 10_000;
const DEFAULT_MAX_LENGTH = 8000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

registerTool(
  "web_fetch",
  "Fetch a URL and return its text content. HTML is stripped automatically.",
  {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch (must be http or https)" },
      maxLength: {
        type: "number",
        description: "Max characters to return (default 8000)",
      },
    },
    required: ["url"],
  },
  async (args) => {
    const url = String(args.url);
    const maxLength = Number(args.maxLength) || DEFAULT_MAX_LENGTH;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { ok: false, error: "Only http and https URLs are supported" };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Context-LocalAI/1.0" },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const raw = await res.text();
      const contentType = res.headers.get("content-type") ?? "";
      const text = contentType.includes("html") ? stripHtml(raw) : raw;
      return { ok: true, output: text.slice(0, maxLength) };
    } catch (err) {
      clearTimeout(timer);
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
