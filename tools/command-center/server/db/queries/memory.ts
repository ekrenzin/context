import { getDb } from "../connection.js";
import type { MemoryRow } from "../types.js";

export interface MemoryFilter {
  type?: string;
  repo?: string;
  limit?: number;
  offset?: number;
}

export function insertMemory(row: Omit<MemoryRow, "created_at" | "updated_at">): void {
  getDb()
    .prepare(
      `INSERT INTO memory (id, type, title, content, tags, repo, ticket)
       VALUES (@id, @type, @title, @content, @tags, @repo, @ticket)`
    )
    .run(row);
}

export function updateMemory(
  id: string,
  fields: Partial<Pick<MemoryRow, "title" | "content" | "tags" | "repo" | "ticket">>
): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: Record<string, unknown> = { id };

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = val;
    }
  }

  getDb()
    .prepare(`UPDATE memory SET ${sets.join(", ")} WHERE id = @id`)
    .run(params);
}

export function getMemory(id: string): MemoryRow | undefined {
  return getDb()
    .prepare("SELECT * FROM memory WHERE id = ?")
    .get(id) as MemoryRow | undefined;
}

export function listMemory(filter: MemoryFilter = {}): MemoryRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.type) {
    clauses.push("type = @type");
    params.type = filter.type;
  }
  if (filter.repo) {
    clauses.push("repo = @repo");
    params.repo = filter.repo;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(`SELECT * FROM memory ${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as MemoryRow[];
}

export function deleteMemory(id: string): void {
  getDb().prepare("DELETE FROM memory WHERE id = ?").run(id);
}
