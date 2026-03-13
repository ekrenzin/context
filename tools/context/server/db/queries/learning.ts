import { getDb } from "../connection.js";
import type { LearningRow } from "../types.js";

export interface LearningFilter {
  type?: string;
  source?: string;
  appliedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export function insertLearning(row: Omit<LearningRow, "created_at" | "applied_at">): void {
  getDb()
    .prepare(
      `INSERT INTO learning (id, type, source, content, metadata)
       VALUES (@id, @type, @source, @content, @metadata)`
    )
    .run(row);
}

export function markApplied(id: string): void {
  getDb()
    .prepare("UPDATE learning SET applied_at = datetime('now') WHERE id = ?")
    .run(id);
}

export function getLearning(id: string): LearningRow | undefined {
  return getDb()
    .prepare("SELECT * FROM learning WHERE id = ?")
    .get(id) as LearningRow | undefined;
}

export function listLearning(filter: LearningFilter = {}): LearningRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.type) {
    clauses.push("type = @type");
    params.type = filter.type;
  }
  if (filter.source) {
    clauses.push("source = @source");
    params.source = filter.source;
  }
  if (filter.appliedOnly) {
    clauses.push("applied_at IS NOT NULL");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(`SELECT * FROM learning ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as LearningRow[];
}

export function deleteLearning(id: string): void {
  getDb().prepare("DELETE FROM learning WHERE id = ?").run(id);
}
