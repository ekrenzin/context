/**
 * Minimal YAML frontmatter parser for rule and skill markdown files.
 * Handles only flat key: value pairs (no nesting, no arrays).
 */

export interface Frontmatter {
  [key: string]: string;
}

export interface ParsedMd {
  meta: Frontmatter;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedMd {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: trimmed };
  }

  const end = trimmed.indexOf("---", 3);
  if (end === -1) {
    return { meta: {}, body: trimmed };
  }

  const block = trimmed.slice(3, end).trim();
  const meta: Frontmatter = {};

  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key) meta[key] = val;
  }

  const body = trimmed.slice(end + 3).trim();
  return { meta, body };
}
