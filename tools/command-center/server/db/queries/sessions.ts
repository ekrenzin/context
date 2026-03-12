import { getDb } from "../connection.js";
import type { SessionRow } from "../types.js";

export interface SessionFilter {
  verdict?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export function upsertSession(row: Omit<SessionRow, "created_at" | "updated_at">): void {
  getDb()
    .prepare(
      `INSERT INTO sessions (
        chat_id, title, summary, verdict, first_query, date, timestamp,
        file_bytes, user_turns, assistant_turns, total_calls,
        tools, skills, skill_counts, subagent_types,
        plan_mode, thinking_blocks,
        response_chars_total, response_chars_avg, response_chars_max, analysis
      ) VALUES (
        @chat_id, @title, @summary, @verdict, @first_query, @date, @timestamp,
        @file_bytes, @user_turns, @assistant_turns, @total_calls,
        @tools, @skills, @skill_counts, @subagent_types,
        @plan_mode, @thinking_blocks,
        @response_chars_total, @response_chars_avg, @response_chars_max, @analysis
      ) ON CONFLICT(chat_id) DO UPDATE SET
        title=excluded.title, summary=excluded.summary, verdict=excluded.verdict,
        first_query=excluded.first_query, file_bytes=excluded.file_bytes,
        user_turns=excluded.user_turns, assistant_turns=excluded.assistant_turns,
        total_calls=excluded.total_calls, tools=excluded.tools, skills=excluded.skills,
        skill_counts=excluded.skill_counts, subagent_types=excluded.subagent_types,
        plan_mode=excluded.plan_mode, thinking_blocks=excluded.thinking_blocks,
        response_chars_total=excluded.response_chars_total,
        response_chars_avg=excluded.response_chars_avg,
        response_chars_max=excluded.response_chars_max,
        analysis=excluded.analysis, updated_at=datetime('now')`
    )
    .run(row);
}

export function getSession(chatId: string): SessionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE chat_id = ?")
    .get(chatId) as SessionRow | undefined;
}

export function listSessions(filter: SessionFilter = {}): SessionRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.verdict) {
    clauses.push("verdict = @verdict");
    params.verdict = filter.verdict;
  }
  if (filter.dateFrom) {
    clauses.push("date >= @dateFrom");
    params.dateFrom = filter.dateFrom;
  }
  if (filter.dateTo) {
    clauses.push("date <= @dateTo");
    params.dateTo = filter.dateTo;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  return getDb()
    .prepare(`SELECT * FROM sessions ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as SessionRow[];
}

export function countSessions(filter: SessionFilter = {}): number {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.verdict) {
    clauses.push("verdict = @verdict");
    params.verdict = filter.verdict;
  }
  if (filter.dateFrom) {
    clauses.push("date >= @dateFrom");
    params.dateFrom = filter.dateFrom;
  }
  if (filter.dateTo) {
    clauses.push("date <= @dateTo");
    params.dateTo = filter.dateTo;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const row = getDb()
    .prepare(`SELECT COUNT(*) as count FROM sessions ${where}`)
    .get(params) as { count: number };

  return row.count;
}

export function deleteSession(chatId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE chat_id = ?").run(chatId);
}
