import fs from "fs";
import path from "path";
import crypto from "crypto";
import { insertMemory, getMemory } from "../db/index.js";
import { VALID_TYPES } from "./index.js";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const KV_RE = /^(\w[\w-]*):\s*(.+)$/gm;

interface ParsedFile {
  frontmatter: Record<string, string>;
  body: string;
}

function parseFrontmatter(text: string): ParsedFile {
  const match = FRONTMATTER_RE.exec(text);
  const frontmatter: Record<string, string> = {};

  if (match) {
    let m: RegExpExecArray | null;
    const block = match[1];
    KV_RE.lastIndex = 0;
    while ((m = KV_RE.exec(block)) !== null) {
      frontmatter[m[1]] = m[2].trim();
    }
    const body = text.replace(FRONTMATTER_RE, "").trim();
    return { frontmatter, body };
  }

  return { frontmatter, body: text.trim() };
}

function firstContentLine(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.replace(/^[-*]\s+/, "").slice(0, 200);
    }
  }
  return "";
}

export function importMarkdownMemory(root: string): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;

  for (const type of VALID_TYPES) {
    const dir = path.join(root, "memory", type);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== ".gitkeep");

    for (const file of files) {
      const text = fs.readFileSync(path.join(dir, file), "utf-8");
      const { frontmatter, body } = parseFrontmatter(text);

      const slug = file.replace(/\.md$/, "");
      const id = `${type}/${slug}`;

      if (getMemory(id)) {
        skipped++;
        continue;
      }

      const title = frontmatter.title || slug.replace(/-/g, " ");
      const tags = frontmatter.tags ? frontmatter.tags.split(",").map((t) => t.trim()) : [];
      const content = body || firstContentLine(text);

      insertMemory({
        id,
        type,
        title,
        content,
        tags: JSON.stringify(tags),
        repo: frontmatter.repo ?? null,
        ticket: frontmatter.ticket ?? null,
      });
      imported++;
    }
  }

  return { imported, skipped };
}
