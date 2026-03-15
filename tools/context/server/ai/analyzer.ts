import crypto from "crypto";
import fs from "fs";
import path from "path";
import { complete } from "./client.js";
import {
  insertDispatchLog,
  updateDispatchAnalysis,
} from "../db/queries/dispatch-log.js";
import { insertMemory } from "../db/queries/memory.js";
import type { DispatchPayload } from "../routes/dispatch.js";

const ANALYZER_MODEL = "claude-haiku-4-5-20251001";

interface AnalysisResult {
  project_context: string | null;
  cross_repo: boolean;
  cross_repo_repos: string[];
  skill_gaps: string[];
  memory_title: string | null;
}

function buildAnalysisPrompt(
  input: string,
  payload: DispatchPayload,
): string {
  return [
    "Analyze this dispatch request for a developer workspace. Extract learnings.",
    "",
    "## Dispatch",
    `User input: ${input}`,
    `Intent: ${payload.analysis.intent} (confidence: ${payload.analysis.confidence})`,
    `Skills matched: ${payload.skills.join(", ") || "none"}`,
    `Repo: ${payload.repo ?? "none"}`,
    `Agent: ${payload.command}`,
    "",
    "## Instructions",
    "Return a JSON object with:",
    '- project_context: if the request reveals project-level context (e.g. "we\'re migrating auth"), extract it as a sentence. null otherwise.',
    "- cross_repo: true if the request likely spans multiple repos",
    "- cross_repo_repos: array of repo names involved if cross_repo is true",
    "- skill_gaps: array of short labels for capabilities needed but not matched by existing skills. Empty if skills matched well.",
    "- memory_title: short title for the memory entry if project_context is set, null otherwise",
    "",
    "Respond with ONLY the JSON object, no markdown fences.",
  ].join("\n");
}

function parseAnalysis(text: string): AnalysisResult {
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      project_context: parsed.project_context ?? null,
      cross_repo: Boolean(parsed.cross_repo),
      cross_repo_repos: Array.isArray(parsed.cross_repo_repos)
        ? parsed.cross_repo_repos.map(String)
        : [],
      skill_gaps: Array.isArray(parsed.skill_gaps)
        ? parsed.skill_gaps.map(String)
        : [],
      memory_title: parsed.memory_title ?? null,
    };
  } catch {
    return {
      project_context: null,
      cross_repo: false,
      cross_repo_repos: [],
      skill_gaps: [],
      memory_title: null,
    };
  }
}

function writeMemoryFile(
  root: string,
  title: string,
  content: string,
): void {
  const memDir = path.join(root, "memory");
  if (!fs.existsSync(memDir)) return;

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const filename = `dispatch-${slug}.md`;
  const filePath = path.join(memDir, filename);

  const frontmatter = [
    "---",
    `name: ${title}`,
    `description: Project context learned from dispatch analysis`,
    "type: project",
    "---",
    "",
    content,
  ].join("\n");

  fs.writeFileSync(filePath, frontmatter, "utf-8");
}

export function logDispatch(
  input: string,
  payload: DispatchPayload,
): string {
  const id = crypto.randomUUID();
  insertDispatchLog({
    id,
    input,
    intent: payload.analysis.intent,
    confidence: payload.analysis.confidence,
    skills: JSON.stringify(payload.skills),
    repo: payload.repo,
    agent: payload.command,
    command: `${payload.command} ${payload.args.join(" ")}`.trim(),
  });
  return id;
}

export async function analyzeDispatch(
  id: string,
  input: string,
  payload: DispatchPayload,
  root: string,
): Promise<void> {
  try {
    const prompt = buildAnalysisPrompt(input, payload);
    const res = await complete({
      prompt,
      model: ANALYZER_MODEL,
      maxTokens: 512,
      temperature: 0,
    });

    const analysis = parseAnalysis(res.text);

    let memoryUpdated = false;
    if (analysis.project_context && analysis.memory_title) {
      const memId = `dispatch-${crypto.randomUUID().slice(0, 8)}`;

      insertMemory({
        id: memId,
        type: "project",
        title: analysis.memory_title,
        content: analysis.project_context,
        tags: JSON.stringify(["dispatch", payload.analysis.intent]),
        repo: payload.repo,
        ticket: null,
      });

      writeMemoryFile(root, analysis.memory_title, analysis.project_context);
      memoryUpdated = true;
    }

    updateDispatchAnalysis(id, {
      cross_repo: analysis.cross_repo,
      cross_repo_detail: analysis.cross_repo_repos.length
        ? analysis.cross_repo_repos.join(", ")
        : undefined,
      skill_gaps: analysis.skill_gaps,
      memory_updated: memoryUpdated,
      analysis_status: "complete",
    });
  } catch (err) {
    updateDispatchAnalysis(id, {
      analysis_status: "error",
      analysis_error: err instanceof Error ? err.message : String(err),
    });
  }
}
