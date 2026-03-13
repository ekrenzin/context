import { getDb } from "../connection.js";
import type { AnalyticsRow } from "../types.js";

export function upsertAnalytics(row: Omit<AnalyticsRow, "created_at">): void {
  getDb()
    .prepare(
      `INSERT INTO analytics (
        date, total_sessions, analyzed_sessions, productive_rate,
        avg_efficiency, current_streak, best_streak,
        total_tool_calls, unique_skills, avg_turns,
        activity_map, trends
      ) VALUES (
        @date, @total_sessions, @analyzed_sessions, @productive_rate,
        @avg_efficiency, @current_streak, @best_streak,
        @total_tool_calls, @unique_skills, @avg_turns,
        @activity_map, @trends
      ) ON CONFLICT(date) DO UPDATE SET
        total_sessions=excluded.total_sessions,
        analyzed_sessions=excluded.analyzed_sessions,
        productive_rate=excluded.productive_rate,
        avg_efficiency=excluded.avg_efficiency,
        current_streak=excluded.current_streak,
        best_streak=excluded.best_streak,
        total_tool_calls=excluded.total_tool_calls,
        unique_skills=excluded.unique_skills,
        avg_turns=excluded.avg_turns,
        activity_map=excluded.activity_map,
        trends=excluded.trends`
    )
    .run(row);
}

export function getAnalytics(date: string): AnalyticsRow | undefined {
  return getDb()
    .prepare("SELECT * FROM analytics WHERE date = ?")
    .get(date) as AnalyticsRow | undefined;
}

export function getLatestAnalytics(): AnalyticsRow | undefined {
  return getDb()
    .prepare("SELECT * FROM analytics ORDER BY date DESC LIMIT 1")
    .get() as AnalyticsRow | undefined;
}

export function listAnalytics(limit = 30): AnalyticsRow[] {
  return getDb()
    .prepare("SELECT * FROM analytics ORDER BY date DESC LIMIT ?")
    .all(limit) as AnalyticsRow[];
}
