import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { loadSessions, loadAnalysis } from "../../routes/sessions.js";
import { loadStatsOverview } from "../../routes/stats.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;
  server.tool(
    "cc_sessions",
    "List recent agent sessions with verdict, skills, and tool usage",
    {
      page: z.number().int().default(0).describe("Page number (0-indexed)"),
      pageSize: z.number().int().default(10).describe("Results per page"),
    },
    async ({ page, pageSize }) => {
      const data = loadSessions(root, page, pageSize);
      if (data.total === 0) {
        return {
          content: [{ type: "text" as const, text: "No sessions found. Run cc_scheduler_run with type 'profile-scan' first." }],
        };
      }

      const lines = data.records.map((r) => {
        const skills = r.skills.length > 0 ? ` [${r.skills.slice(0, 3).join(", ")}]` : "";
        return `${r.date} [${r.verdict || "?"}] ${r.title || r.firstQuery?.slice(0, 60) || "(untitled)"}${skills} (${r.totalCalls} calls, ${r.userTurns} turns)`;
      });

      const header = `Sessions (page ${data.page + 1}/${data.totalPages}, ${data.total} total)`;
      return {
        content: [{ type: "text" as const, text: `${header}\n\n${lines.join("\n")}` }],
      };
    },
  );

  server.tool(
    "cc_session_detail",
    "Get detailed analysis of a specific session by chat ID",
    {
      chatId: z.string().describe("Session chat ID"),
    },
    async ({ chatId }) => {
      const analysis = loadAnalysis(root, chatId);
      if (!analysis) {
        return {
          content: [{ type: "text" as const, text: `No analysis found for ${chatId}` }],
          isError: true,
        };
      }

      const lines = [
        `Title: ${analysis.title}`,
        `Verdict: ${analysis.verdict}`,
        `Efficiency: ${analysis.efficiency.score}/10`,
        "",
        `Summary: ${analysis.summary}`,
        "",
        analysis.wins.length > 0 ? `Wins:\n${analysis.wins.map((w) => `  + ${w}`).join("\n")}` : "",
        analysis.errors.length > 0 ? `Errors:\n${analysis.errors.map((e) => `  - ${e}`).join("\n")}` : "",
        analysis.gaps.length > 0 ? `Gaps:\n${analysis.gaps.map((g) => `  * ${g}`).join("\n")}` : "",
        analysis.recommendations.length > 0
          ? `Recommendations:\n${analysis.recommendations.map((r) => `  > ${r}`).join("\n")}`
          : "",
      ].filter(Boolean);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_stats",
    "Get analytics overview: productivity rate, streaks, trends, tool usage",
    {},
    async () => {
      const stats = loadStatsOverview(root);
      if (!stats) {
        return {
          content: [{ type: "text" as const, text: "No stats available. Run a profile scan first." }],
        };
      }

      const trend = (t: { direction: string; delta: number }) =>
        `${t.direction} (${t.delta > 0 ? "+" : ""}${t.delta}%)`;

      const lines = [
        `Sessions: ${stats.totalSessions} total, ${stats.analyzedSessions} analyzed`,
        `Productive: ${stats.productiveRate}%  (trend: ${trend(stats.trends.productiveRate)})`,
        `Avg efficiency: ${stats.avgEfficiency}/10`,
        `Streak: ${stats.currentStreak} current, ${stats.bestStreak} best`,
        `Tool calls: ${stats.totalToolCalls}  (trend: ${trend(stats.trends.toolCalls)})`,
        `Unique skills: ${stats.uniqueSkills}`,
        `Avg turns/session: ${stats.avgTurns}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
