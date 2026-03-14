import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { SessionRecord, SessionsPage, SessionAnalysis } from "../types.js";
import { analyzeSessions } from "../ai/analyze-sessions.js";

export function loadSessions(
  root: string,
  page: number,
  pageSize = 25,
): SessionsPage {
  const filePath = path.join(root, "memory", "profile", "agent-sessions.jsonl");
  let records: SessionRecord[] = [];
  try {
    const content = fs.readFileSync(filePath, "utf8");
    records = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line) => {
        const raw = JSON.parse(line) as Record<string, unknown>;
        return {
          chatId: (raw.chat_id as string) ?? "",
          title: (raw.title as string) ?? "",
          summary: (raw.summary as string) ?? "",
          verdict: (raw.verdict as string) ?? "",
          firstQuery: (raw.first_query as string) ?? "",
          date: (raw.date as string) ?? "",
          timestamp: (raw.timestamp as string) ?? "",
          fileBytes: (raw.file_bytes as number) ?? 0,
          userTurns: (raw.user_turns as number) ?? 0,
          assistantTurns: (raw.assistant_turns as number) ?? 0,
          totalCalls: (raw.total_tool_calls as number) ?? 0,
          tools: (raw.tools as Record<string, number>) ?? {},
          skills: (raw.skills as string[]) ?? [],
          skillCounts: (raw.skill_counts as Record<string, number>) ?? {},
          subagentTypes: (raw.subagent_types as Record<string, number>) ?? {},
          planMode: (raw.plan_mode as boolean) ?? false,
          thinkingBlocks: (raw.thinking_blocks as number) ?? 0,
          responseCharsTotal: (raw.response_chars_total as number) ?? 0,
          responseCharsAvg: (raw.response_chars_avg as number) ?? 0,
          responseCharsMax: (raw.response_chars_max as number) ?? 0,
        };
      })
      .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  } catch {
    return { records: [], page: 0, totalPages: 0, total: 0 };
  }
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
  const start = pageIndex * pageSize;
  return {
    records: records.slice(start, start + pageSize),
    page: pageIndex,
    totalPages,
    total,
  };
}

export function loadAnalysis(
  root: string,
  chatId: string,
): SessionAnalysis | null {
  try {
    const filePath = path.join(
      root,
      "memory",
      "profile",
      "analyses",
      `${chatId}.json`,
    );
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      unknown
    >;
    const eff = (raw.efficiency as Record<string, unknown>) ?? {};
    return {
      verdict: (raw.verdict as string) ?? "",
      title: (raw.title as string) ?? "",
      summary: (raw.summary as string) ?? "",
      wins: (raw.wins as string[]) ?? [],
      errors: (raw.errors as string[]) ?? [],
      gaps: (raw.gaps as string[]) ?? [],
      userStats: (raw.user_stats as Record<string, number>) ?? {},
      agentStats: (raw.agent_stats as Record<string, number>) ?? {},
      efficiency: {
        wastedCycles: (eff.wasted_cycles as string) ?? "",
        bottlenecks: (eff.bottlenecks as string) ?? "",
        score: (eff.score as number) ?? 0,
      },
      insights: (raw.insights as string[]) ?? [],
      recommendations: (raw.recommendations as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

function parseJsonlTranscript(raw: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const role = entry.role as string;
    if (role !== "user" && role !== "assistant") continue;
    const msg = entry.message as Record<string, unknown> | undefined;
    const content = msg?.content;
    let text = "";
    if (Array.isArray(content)) {
      text = content
        .filter((c: Record<string, unknown>) => c.type === "text")
        .map((c: Record<string, unknown>) => (c.text as string) ?? "")
        .join("\n")
        .trim();
    } else if (typeof content === "string") {
      text = content.trim();
    }
    if (!text) continue;
    if (role === "user") {
      const match = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
      text = match ? match[1].trim() : text;
    }
    turns.push({ role: role as "user" | "assistant", text });
  }
  return turns;
}

function stripToolNoise(text: string): string {
  return text
    .replace(/\[Tool call\][^\n]*(\n[ \t]+[^\n]*)*/g, "")
    .replace(/\[Tool result\][^\n]*(\n(?!user:|assistant:)[^\n]*)*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTxtTranscript(raw: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const segments = raw.split(/\n(?=user:|assistant:)/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("user:")) {
      let text = trimmed.slice("user:".length).trim();
      const match = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
      text = match ? match[1].trim() : text;
      if (text) turns.push({ role: "user", text });
    } else if (trimmed.startsWith("assistant:")) {
      const raw_text = trimmed.slice("assistant:".length).trim();
      const text = stripToolNoise(raw_text);
      if (text) turns.push({ role: "assistant", text });
    }
  }
  return turns;
}

function loadTranscript(transcriptDir: string, chatId: string): ChatTurn[] {
  const jsonlPath = path.join(transcriptDir, `${chatId}.jsonl`);
  if (fs.existsSync(jsonlPath)) {
    try {
      return parseJsonlTranscript(fs.readFileSync(jsonlPath, "utf8"));
    } catch {
      /* fall through */
    }
  }
  const txtPath = path.join(transcriptDir, `${chatId}.txt`);
  if (fs.existsSync(txtPath)) {
    try {
      return parseTxtTranscript(fs.readFileSync(txtPath, "utf8"));
    } catch {
      /* fall through */
    }
  }
  return [];
}

export function registerSessionRoutes(
  app: FastifyInstance,
  root: string,
  transcriptDir: string,
): void {
  app.get("/api/sessions", async (req) => {
    const query = req.query as { page?: string; pageSize?: string };
    const page = parseInt(query.page ?? "0", 10);
    const pageSize = parseInt(query.pageSize ?? "25", 10);
    return loadSessions(root, page, pageSize);
  });

  app.get<{ Params: { chatId: string } }>(
    "/api/sessions/:chatId",
    async (req) => {
      const { chatId } = req.params;
      const allSessions = loadSessions(root, 0, 100000);
      const record =
        allSessions.records.find((r) => r.chatId === chatId) ?? null;
      const analysis = loadAnalysis(root, chatId);
      return { record, analysis };
    },
  );

  app.get<{ Params: { chatId: string } }>(
    "/api/sessions/:chatId/transcript",
    async (req) => {
      const { chatId } = req.params;
      const turns = loadTranscript(transcriptDir, chatId);
      return { turns };
    },
  );

  app.post<{ Body: { chatId?: string; limit?: number; force?: boolean } }>(
    "/api/sessions/analyze",
    async (req) => {
      const { chatId, limit, force } = req.body ?? {};
      return analyzeSessions(root, transcriptDir, {
        chatId,
        limit: limit ?? 10,
        force,
      });
    },
  );
}
