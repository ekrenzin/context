import fs from "fs";
import path from "path";
import type { MemoryEntry } from "./index.js";

function slugFromId(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1];
}

function buildFrontmatter(entry: MemoryEntry): string {
  const lines = ["---"];
  lines.push(`title: ${entry.title}`);
  lines.push(`date: ${entry.createdAt.slice(0, 10)}`);
  if (entry.ticket) lines.push(`ticket: ${entry.ticket}`);
  if (entry.repo) lines.push(`repo: ${entry.repo}`);
  if (entry.tags.length) lines.push(`tags: ${entry.tags.join(", ")}`);
  lines.push("---");
  return lines.join("\n");
}

function exportDir(root: string, type: string): string {
  return path.join(root, "memory", type);
}

export function exportEntry(root: string, entry: MemoryEntry): void {
  const dir = exportDir(root, entry.type);
  fs.mkdirSync(dir, { recursive: true });

  const slug = slugFromId(entry.id);
  const filePath = path.join(dir, `${slug}.md`);
  const content = `${buildFrontmatter(entry)}\n\n${entry.content}\n`;

  fs.writeFileSync(filePath, content, "utf-8");
}

export function removeExport(root: string, entry: MemoryEntry): void {
  const dir = exportDir(root, entry.type);
  const slug = slugFromId(entry.id);
  const filePath = path.join(dir, `${slug}.md`);

  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
}
