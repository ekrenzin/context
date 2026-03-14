import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import {
  listMemory,
  listLearning,
  listApprovals,
  listSessions,
  getSession,
  countSessions,
} from "../db/index.js";
import type { MemoryRow, LearningRow, SessionRow } from "../db/index.js";

function parseSkillCounts(row: SessionRow): Record<string, number> {
  try {
    return JSON.parse(row.skill_counts) as Record<string, number>;
  } catch {
    return {};
  }
}

export function registerKnowledgeRoutes(app: FastifyInstance, root: string): void {
  // Memory entries with optional type filter and search
  app.get("/api/knowledge/memory", async (req) => {
    const query = req.query as { type?: string; q?: string; limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const rows = listMemory({ type: query.type, limit, offset });

    let filtered: MemoryRow[] = rows;
    if (query.q) {
      const q = query.q.toLowerCase();
      filtered = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.tags.toLowerCase().includes(q),
      );
    }

    return { items: filtered, total: filtered.length };
  });

  // Learning entries with optional type filter
  app.get("/api/knowledge/learning", async (req) => {
    const query = req.query as { type?: string; limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const rows = listLearning({ type: query.type, limit, offset });
    return { items: rows, total: rows.length };
  });

  // Skill evolution timeline
  app.get<{ Params: { name: string } }>(
    "/api/knowledge/skills/:name/timeline",
    async (req) => {
      const { name } = req.params;

      // Find sessions that used this skill
      const allSessions = listSessions({ limit: 200 });
      const usedIn = allSessions.filter((s) => {
        const counts = parseSkillCounts(s);
        return name in counts;
      });

      // Find related approvals (skill evolutions)
      const approvals = listApprovals({
        type: "skill_evolution",
        limit: 50,
      }).filter((a) => {
        try {
          const diff = JSON.parse(a.diff);
          return diff.skillName === name;
        } catch {
          return a.title.includes(name);
        }
      });

      // Find related learning entries
      const learnings = listLearning({
        type: "evolution",
        source: name,
        limit: 50,
      });

      // Try to read the current skill content
      let currentContent: string | null = null;
      const skillPath = path.join(root, "skills", name, "SKILL.md");
      try {
        currentContent = fs.readFileSync(skillPath, "utf-8");
      } catch {
        // Skill file may not exist
      }

      return {
        name,
        currentContent,
        sessionsUsedIn: usedIn.length,
        sessions: usedIn.slice(0, 20).map((s) => ({
          chatId: s.chat_id,
          title: s.title,
          date: s.date,
          verdict: s.verdict,
        })),
        evolutions: approvals.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          createdAt: a.created_at,
          reviewedAt: a.reviewed_at,
        })),
        learnings: learnings.map((l) => ({
          id: l.id,
          content: l.content,
          createdAt: l.created_at,
          appliedAt: l.applied_at,
        })),
      };
    },
  );

  // Growth narrative (structured summary, no AI call required)
  app.get("/api/knowledge/narrative", async (req) => {
    const query = req.query as { days?: string };
    const days = query.days ? parseInt(query.days, 10) : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateFrom = since.toISOString().slice(0, 10);

    const recentSessions = listSessions({ dateFrom, limit: 500 });
    const totalSessions = recentSessions.length;
    const analyzedSessions = recentSessions.filter((s) => s.analysis).length;

    const verdictCounts: Record<string, number> = {};
    for (const s of recentSessions) {
      if (s.verdict) {
        verdictCounts[s.verdict] = (verdictCounts[s.verdict] ?? 0) + 1;
      }
    }

    const recentApprovals = listApprovals({ limit: 100 }).filter(
      (a) => a.created_at >= dateFrom,
    );
    const approvedCount = recentApprovals.filter((a) => a.status === "approved").length;
    const pendingCount = recentApprovals.filter((a) => a.status === "pending").length;

    const recentLearnings = listLearning({ limit: 100 }).filter(
      (l) => l.created_at >= dateFrom,
    );

    const allMemory = listMemory({ limit: 1000 });
    const allLearnings = listLearning({ limit: 1000 });

    // Skill usage
    const skillCounts = new Map<string, number>();
    for (const s of recentSessions) {
      const counts = parseSkillCounts(s);
      for (const [skill, n] of Object.entries(counts)) {
        skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + n);
      }
    }
    const topSkills = [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      period: { days, since: dateFrom },
      sessions: { total: totalSessions, analyzed: analyzedSessions, verdicts: verdictCounts },
      approvals: { total: recentApprovals.length, approved: approvedCount, pending: pendingCount },
      learnings: { recent: recentLearnings.length },
      topSkills,
      depth: {
        memoryEntries: allMemory.length,
        learningEntries: allLearnings.length,
        totalSessions: countSessions(),
      },
    };
  });

  // Session insights -- session analysis plus linked knowledge
  app.get<{ Params: { chatId: string } }>(
    "/api/sessions/:chatId/insights",
    async (req) => {
      const { chatId } = req.params;
      const session = getSession(chatId);
      if (!session) return { session: null, analysis: null, linkedMemory: [], linkedLearning: [] };

      let analysis = null;
      if (session.analysis) {
        try {
          analysis = JSON.parse(session.analysis);
        } catch {
          // malformed
        }
      }

      // Find memory/learning entries that reference this session
      const allLearning = listLearning({ limit: 200 });
      const linkedLearning = allLearning.filter((l) => {
        try {
          const meta = JSON.parse(l.metadata);
          const sourceIds: string[] = meta.sourceSessionIds ?? [];
          return sourceIds.includes(chatId);
        } catch {
          return false;
        }
      });

      return {
        session: {
          chatId: session.chat_id,
          title: session.title,
          summary: session.summary,
          verdict: session.verdict,
          date: session.date,
          skills: JSON.parse(session.skills),
          skillCounts: parseSkillCounts(session),
          userTurns: session.user_turns,
          assistantTurns: session.assistant_turns,
          totalCalls: session.total_calls,
          fileBytes: session.file_bytes,
        },
        analysis,
        linkedMemory: [],
        linkedLearning: linkedLearning.map((l) => ({
          id: l.id,
          type: l.type,
          content: l.content,
          createdAt: l.created_at,
        })),
      };
    },
  );
}
