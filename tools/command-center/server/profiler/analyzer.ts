import { complete, ANALYSIS_SYSTEM, analysisPrompt } from "../ai/index.js";
import { upsertSession, getSession } from "../db/index.js";
import type { SessionAnalysis } from "../types.js";
import type { ParsedSession } from "./parser.js";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function analyzeSession(
  session: ParsedSession,
  transcriptPath: string,
  force = false,
): Promise<SessionAnalysis | null> {
  const existing = getSession(session.chatId);
  if (!force && existing?.analysis) return JSON.parse(existing.analysis);

  const response = await complete({
    system: ANALYSIS_SYSTEM,
    prompt: analysisPrompt(transcriptPath),
    maxTokens: 4096,
    temperature: 0,
  });

  const analysis = extractJson(response.text) as SessionAnalysis;

  upsertSession({
    chat_id: session.chatId,
    title: analysis.title ?? "",
    summary: analysis.summary ?? "",
    verdict: analysis.verdict ?? "",
    first_query: session.firstQuery,
    date: session.date,
    timestamp: session.timestamp,
    file_bytes: session.fileBytes,
    user_turns: session.userTurns,
    assistant_turns: session.assistantTurns,
    total_calls: session.totalCalls,
    tools: JSON.stringify(session.tools),
    skills: JSON.stringify(session.skills),
    skill_counts: JSON.stringify(session.skillCounts),
    subagent_types: JSON.stringify(session.subagentTypes),
    plan_mode: session.planMode ? 1 : 0,
    thinking_blocks: session.thinkingBlocks,
    response_chars_total: session.responseCharsTotal,
    response_chars_avg: session.responseCharsAvg,
    response_chars_max: session.responseCharsMax,
    analysis: JSON.stringify(analysis),
  });

  return analysis;
}
