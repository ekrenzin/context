import { complete } from "./client.js";
import type { SkillNode } from "../types.js";

export interface RepoInfo {
  name: string;
  description: string;
  present: boolean;
}

export interface ClassificationResult {
  intent: string;
  confidence: number;
  skills: string[];
  repo: string | null;
  agent: "claude" | "codex";
}

const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

function buildClassifierPrompt(
  input: string,
  skills: SkillNode[],
  repos: RepoInfo[],
): string {
  const skillList = skills
    .map((s) => `- ${s.id}: ${s.description} [${s.category}]`)
    .join("\n");

  const repoList = repos
    .filter((r) => r.present)
    .map((r) => `- ${r.name}: ${r.description}`)
    .join("\n");

  return [
    "Classify the following user request for a developer workspace.",
    "",
    "## Available Skills",
    skillList || "(none)",
    "",
    "## Available Repos",
    repoList || "(none)",
    "",
    "## Instructions",
    "Return a JSON object with these fields:",
    '- intent: short label (e.g. "bug-fix", "feature", "refactor", "question", "deploy", "git-ops", "debug")',
    "- confidence: 0-1 float",
    "- skills: array of skill IDs that match (empty if none)",
    "- repo: target repo name or null if ambiguous",
    '- agent: "claude" for code tasks, "codex" for broad multi-file changes',
    "",
    "Respond with ONLY the JSON object, no markdown fences.",
    "",
    "## User Request",
    input,
  ].join("\n");
}

function parseClassification(text: string): ClassificationResult {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      intent: String(parsed.intent ?? "unknown"),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
      repo: parsed.repo ? String(parsed.repo) : null,
      agent: parsed.agent === "codex" ? "codex" : "claude",
    };
  } catch {
    return { intent: "unknown", confidence: 0.3, skills: [], repo: null, agent: "claude" };
  }
}

export async function classifyRequest(
  input: string,
  skills: SkillNode[],
  repos: RepoInfo[],
): Promise<ClassificationResult> {
  const prompt = buildClassifierPrompt(input, skills, repos);

  const res = await complete({
    prompt,
    model: CLASSIFIER_MODEL,
    maxTokens: 256,
    temperature: 0,
  });

  return parseClassification(res.text);
}
