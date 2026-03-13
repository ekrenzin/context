import { getDb } from "../connection.js";
import type { ProjectRow } from "../types.js";

export interface ProjectFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export function insertProject(row: Omit<ProjectRow, "created_at" | "updated_at">): void {
  getDb()
    .prepare(
      `INSERT INTO projects (id, name, slug, description, root_path, status, config)
       VALUES (@id, @name, @slug, @description, @root_path, @status, @config)`,
    )
    .run(row);
}

export function getProject(id: string): ProjectRow | undefined {
  return getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as ProjectRow | undefined;
}

export function getProjectBySlug(slug: string): ProjectRow | undefined {
  return getDb()
    .prepare("SELECT * FROM projects WHERE slug = ?")
    .get(slug) as ProjectRow | undefined;
}

export function listProjects(filter: ProjectFilter = {}): ProjectRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.status) {
    clauses.push("status = @status");
    params.status = filter.status;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(
      `SELECT * FROM projects ${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as ProjectRow[];
}

export function updateProject(
  id: string,
  fields: Partial<Pick<ProjectRow, "name" | "description" | "status" | "config">>,
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
    .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = @id`)
    .run(params);
}

export function deleteProject(id: string): void {
  getDb()
    .prepare("UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?")
    .run(id);
}
