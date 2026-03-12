import { getDb } from "../connection.js";
import type { FeedEventRow } from "../types.js";

export interface FeedFilter {
  project_id?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export function insertFeedEvent(
  row: Omit<FeedEventRow, "created_at">,
): void {
  getDb()
    .prepare(
      `INSERT INTO feed_events (id, project_id, type, title, detail)
       VALUES (@id, @project_id, @type, @title, @detail)`,
    )
    .run(row);
}

export function listFeedEvents(filter: FeedFilter = {}): FeedEventRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.project_id) {
    clauses.push("project_id = @project_id");
    params.project_id = filter.project_id;
  }
  if (filter.type) {
    clauses.push("type = @type");
    params.type = filter.type;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(
      `SELECT * FROM feed_events ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as FeedEventRow[];
}

export function countFeedEvents(projectId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM feed_events WHERE project_id = ?")
    .get(projectId) as { count: number };
  return row.count;
}
