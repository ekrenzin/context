import fs from "fs";
import path from "path";
import { syncAll } from "../adapters/registry.js";

export interface IntelItem {
  name: string;
  description: string;
  content: string;
}

export function extractFrontmatterField(content: string, field: string): string {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

export function listDir(dir: string, ext: string): IntelItem[] {
  if (!fs.existsSync(dir)) return [];
  const results: IntelItem[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
      results.push({
        name: entry.name.replace(ext, ""),
        description: extractFrontmatterField(content, "description"),
        content,
      });
    }
  }

  return results;
}

export function listSkillDirs(skillsDir: string): IntelItem[] {
  if (!fs.existsSync(skillsDir)) return [];
  const results: IntelItem[] = [];

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, "utf-8");
    results.push({
      name: entry.name,
      description: extractFrontmatterField(content, "description"),
      content,
    });
  }

  return results;
}

export function listMemoryFiles(
  memDir: string,
  category?: string,
  query?: string,
): IntelItem[] {
  if (!fs.existsSync(memDir)) return [];
  const results: IntelItem[] = [];
  const categories = category
    ? [category]
    : fs.readdirSync(memDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

  for (const cat of categories) {
    const catDir = path.join(memDir, cat);
    if (!fs.existsSync(catDir)) continue;

    for (const file of fs.readdirSync(catDir).filter((f) => f.endsWith(".md"))) {
      const content = fs.readFileSync(path.join(catDir, file), "utf-8");
      if (query && !content.toLowerCase().includes(query.toLowerCase())) continue;

      results.push({
        name: `${cat}/${file.replace(".md", "")}`,
        description: extractFrontmatterField(content, "title"),
        content,
      });
    }
  }

  return results;
}

export function triggerSync(rootPath: string, config: string): void {
  try {
    const parsed = JSON.parse(config);
    const ides = (parsed.ides ?? ["cursor"]) as string[];
    syncAll(rootPath, ides);
  } catch {
    // non-blocking sync failure
  }
}
