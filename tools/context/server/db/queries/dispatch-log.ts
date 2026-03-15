import { getDb } from "../connection.js";
import type { DispatchLogRow } from "../types.js";

export function insertDispatchLog(
  row: Pick<
    DispatchLogRow,
    "id" | "input" | "intent" | "confidence" | "skills" | "repo" | "agent" | "command"
  >,
): void {
  getDb()
    .prepare(
      `INSERT INTO dispatch_log (id, input, intent, confidence, skills, repo, agent, command)
       VALUES (@id, @input, @intent, @confidence, @skills, @repo, @agent, @command)`,
    )
    .run(row);
}

export function updateDispatchAnalysis(
  id: string,
  fields: {
    cross_repo?: boolean;
    cross_repo_detail?: string;
    skill_gaps?: string[];
    memory_updated?: boolean;
    analysis_status: "complete" | "error";
    analysis_error?: string;
  },
): void {
  getDb()
    .prepare(
      `UPDATE dispatch_log SET
        cross_repo = @cross_repo,
        cross_repo_detail = @cross_repo_detail,
        skill_gaps = @skill_gaps,
        memory_updated = @memory_updated,
        analysis_status = @analysis_status,
        analysis_error = @analysis_error,
        analyzed_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id,
      cross_repo: fields.cross_repo ? 1 : 0,
      cross_repo_detail: fields.cross_repo_detail ?? null,
      skill_gaps: fields.skill_gaps?.length
        ? JSON.stringify(fields.skill_gaps)
        : null,
      memory_updated: fields.memory_updated ? 1 : 0,
      analysis_status: fields.analysis_status,
      analysis_error: fields.analysis_error ?? null,
    });
}

export function listDispatchLog(limit = 50, offset = 0): DispatchLogRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM dispatch_log ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ limit, offset }) as DispatchLogRow[];
}

export function getDispatchLog(id: string): DispatchLogRow | undefined {
  return getDb()
    .prepare("SELECT * FROM dispatch_log WHERE id = ?")
    .get(id) as DispatchLogRow | undefined;
}
