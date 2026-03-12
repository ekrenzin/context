import crypto from "crypto";
import { insertMemory, updateMemory, getMemory, listMemory, deleteMemory } from "../db/index.js";
import type { MemoryRow, MemoryFilter } from "../db/index.js";
import { exportEntry, removeExport } from "./export.js";

export const VALID_TYPES = [
  "decisions",
  "known-issues",
  "progress",
  "preferences",
  "observations",
  "environment",
] as const;

export type MemoryType = (typeof VALID_TYPES)[number];

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  repo?: string;
  ticket?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    type: row.type as MemoryType,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags),
    repo: row.repo ?? undefined,
    ticket: row.ticket ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function write(
  root: string,
  opts: { type: MemoryType; title: string; content: string; tags?: string[]; repo?: string; ticket?: string }
): MemoryEntry {
  const slug = opts.ticket ? slugify(opts.ticket) : slugify(opts.title);
  const id = `${opts.type}/${slug}-${crypto.randomBytes(4).toString("hex")}`;

  insertMemory({
    id,
    type: opts.type,
    title: opts.title,
    content: opts.content,
    tags: JSON.stringify(opts.tags ?? []),
    repo: opts.repo ?? null,
    ticket: opts.ticket ?? null,
  });

  const entry = rowToEntry(getMemory(id)!);
  exportEntry(root, entry);
  return entry;
}

export function read(id: string): MemoryEntry | undefined {
  const row = getMemory(id);
  return row ? rowToEntry(row) : undefined;
}

export function scan(filter: MemoryFilter & { query?: string }): MemoryEntry[] {
  const rows = listMemory(filter);
  const entries = rows.map(rowToEntry);

  if (!filter.query) return entries;

  return scoreAndSort(entries, filter.query);
}

function scoreAndSort(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = entries.map((e) => {
    let score = 0;
    const haystack = `${e.title} ${e.content}`.toLowerCase().slice(0, 700);

    for (const kw of keywords) {
      if (haystack.includes(kw)) score += 5;
    }

    const ageMs = Date.now() - new Date(e.updatedAt).getTime();
    const ageDays = ageMs / 86_400_000;
    if (ageDays <= 7) score += Math.max(1, Math.round(10 - ageDays));

    return { entry: e, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

export function update(
  root: string,
  id: string,
  fields: Partial<Pick<MemoryEntry, "title" | "content" | "tags" | "repo" | "ticket">>
): MemoryEntry | undefined {
  const dbFields: Record<string, string | undefined> = {};
  if (fields.title !== undefined) dbFields.title = fields.title;
  if (fields.content !== undefined) dbFields.content = fields.content;
  if (fields.tags !== undefined) dbFields.tags = JSON.stringify(fields.tags);
  if (fields.repo !== undefined) dbFields.repo = fields.repo;
  if (fields.ticket !== undefined) dbFields.ticket = fields.ticket;

  updateMemory(id, dbFields);

  const entry = read(id);
  if (entry) exportEntry(root, entry);
  return entry;
}

export function remove(root: string, id: string): void {
  const entry = read(id);
  deleteMemory(id);
  if (entry) removeExport(root, entry);
}
