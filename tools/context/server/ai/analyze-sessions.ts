import fs from "fs";
import path from "path";
import { complete } from "./client.js";
import { ANALYSIS_SYSTEM } from "./prompts.js";

interface RawAnalysis {
  verdict: string;
  title: string;
  summary: string;
  wins: string[];
  errors: string[];
  gaps: string[];
  user_stats: Record<string, number>;
  agent_stats: Record<string, number>;
  efficiency: { wasted_cycles: string; bottlenecks: string; score: number };
  insights: string[];
  recommendations: string[];
}

interface SessionLine {
  chat_id: string;
  title?: string;
  summary?: string;
  verdict?: string;
  [key: string]: unknown;
}

interface AnalyzeResult {
  analyzed: number;
  skipped: number;
  failed: number;
  total: number;
}

function loadSessionLines(sessionsPath: string): SessionLine[] {
  try {
    return fs
      .readFileSync(sessionsPath, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as SessionLine);
  } catch {
    return [];
  }
}

function readTranscript(
  transcriptDir: string,
  chatId: string,
): string | null {
  for (const ext of [".jsonl", ".txt"]) {
    const p = path.join(transcriptDir, `${chatId}${ext}`);
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf8");
        if (content.length > 200_000) {
          return content.slice(0, 200_000) + "\n[...truncated]";
        }
        return content;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function buildPrompt(transcript: string): string {
  return `Here is a full AI agent chat transcript:

<transcript>
${transcript}
</transcript>

Produce a deep retrospective analysis as a JSON object. Evaluate BOTH the human user and the AI agent. Be honest and critical. Score stats 1-10 where 1 is terrible and 10 is exceptional.

Required JSON schema (respond with ONLY this JSON, no markdown fences):
{
  "verdict": "<one of: productive, mixed, struggling, blocked>",
  "title": "<6 words max>",
  "summary": "<2-3 sentence narrative>",
  "wins": ["<concrete positive outcomes>"],
  "errors": ["<mistakes, failed attempts>"],
  "gaps": ["<missing knowledge, unused tools>"],
  "user_stats": {
    "clarity": <1-10>, "frustration": <1-10>, "engagement": <1-10>,
    "ambition": <1-10>, "adaptability": <1-10>
  },
  "agent_stats": {
    "competence": <1-10>, "efficiency": <1-10>, "creativity": <1-10>,
    "autonomy": <1-10>, "thoroughness": <1-10>
  },
  "efficiency": {
    "wasted_cycles": "<description>",
    "bottlenecks": "<what slowed things down>",
    "score": <1-10>
  },
  "insights": ["<non-obvious observations>"],
  "recommendations": ["<actionable suggestions>"]
}`;
}

function parseAnalysis(text: string): RawAnalysis | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as RawAnalysis;
    if (!parsed.verdict || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function analyzeSessions(
  root: string,
  transcriptDir: string,
  options: { limit?: number; chatId?: string; force?: boolean } = {},
): Promise<AnalyzeResult> {
  const sessionsPath = path.join(
    root,
    "memory",
    "profile",
    "agent-sessions.jsonl",
  );
  const analysesDir = path.join(root, "memory", "profile", "analyses");

  const sessions = loadSessionLines(sessionsPath);
  if (!sessions.length) {
    return { analyzed: 0, skipped: 0, failed: 0, total: 0 };
  }

  fs.mkdirSync(analysesDir, { recursive: true });

  let targets: SessionLine[];
  if (options.chatId) {
    targets = sessions.filter((s) => s.chat_id === options.chatId);
  } else {
    targets = sessions.filter(
      (s) =>
        options.force ||
        !fs.existsSync(path.join(analysesDir, `${s.chat_id}.json`)),
    );
  }

  if (!options.chatId && options.limit && targets.length > options.limit) {
    targets = targets.slice(-options.limit);
  }

  const result: AnalyzeResult = {
    analyzed: 0,
    skipped: 0,
    failed: 0,
    total: sessions.length,
  };

  const sessionMap = new Map(sessions.map((s) => [s.chat_id, s]));

  for (const session of targets) {
    const transcript = readTranscript(transcriptDir, session.chat_id);
    if (!transcript) {
      result.skipped++;
      continue;
    }

    try {
      const response = await complete({
        system: ANALYSIS_SYSTEM,
        prompt: buildPrompt(transcript),
        maxTokens: 4096,
        temperature: 0,
      });

      const analysis = parseAnalysis(response.text);
      if (!analysis) {
        result.failed++;
        continue;
      }

      fs.writeFileSync(
        path.join(analysesDir, `${session.chat_id}.json`),
        JSON.stringify(analysis, null, 2),
      );

      const entry = sessionMap.get(session.chat_id);
      if (entry) {
        entry.title = analysis.title;
        entry.summary = analysis.summary;
        entry.verdict = analysis.verdict;
      }

      result.analyzed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Analysis failed for ${session.chat_id.slice(0, 8)}: ${msg}`);
      result.failed++;
      if (msg.includes("No AI provider configured") || msg.includes("No API key")) {
        break;
      }
    }
  }

  if (result.analyzed > 0) {
    const updated = [...sessionMap.values()];
    updated.sort((a, b) => {
      const ta = (a.timestamp as string) ?? "";
      const tb = (b.timestamp as string) ?? "";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    fs.writeFileSync(
      sessionsPath,
      updated.map((s) => JSON.stringify(s)).join("\n") + "\n",
    );
  }

  return result;
}
