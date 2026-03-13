import { getDb } from "../connection.js";
import type { ApprovalRow } from "../types.js";

export interface ApprovalFilter {
  project_id?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export function insertApproval(
  row: Omit<ApprovalRow, "created_at" | "reviewed_at">,
): void {
  getDb()
    .prepare(
      `INSERT INTO approvals (id, project_id, type, title, summary, diff, status)
       VALUES (@id, @project_id, @type, @title, @summary, @diff, @status)`,
    )
    .run(row);
}

export function getApproval(id: string): ApprovalRow | undefined {
  return getDb()
    .prepare("SELECT * FROM approvals WHERE id = ?")
    .get(id) as ApprovalRow | undefined;
}

export function listApprovals(filter: ApprovalFilter = {}): ApprovalRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.project_id) {
    clauses.push("project_id = @project_id");
    params.project_id = filter.project_id;
  }
  if (filter.status) {
    clauses.push("status = @status");
    params.status = filter.status;
  }
  if (filter.type) {
    clauses.push("type = @type");
    params.type = filter.type;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(
      `SELECT * FROM approvals ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as ApprovalRow[];
}

export function resolveApproval(id: string, status: "approved" | "rejected"): void {
  getDb()
    .prepare(
      "UPDATE approvals SET status = @status, reviewed_at = datetime('now') WHERE id = @id",
    )
    .run({ id, status });
}

export function countPendingApprovals(projectId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) as count FROM approvals WHERE project_id = ? AND status = 'pending'",
    )
    .get(projectId) as { count: number };
  return row.count;
}
