import { randomUUID } from "crypto";
import { complete } from "../ai/client.js";
import {
  SOLUTION_SYSTEM,
  solutionArchitectPrompt,
  solutionRulePrompt,
  solutionServicePrompt,
  solutionSkillPrompt,
  solutionViewPrompt,
} from "../ai/solution-prompts.js";

export interface SolutionComponent {
  type: string;
}

export interface BuildSolutionResult {
  id: string;
  name: string;
  problem: string;
  components: SolutionComponent[];
  files: Array<{ path: string; content: string }>;
}

export interface BuildSolutionOpts {
  problem: string;
  name: string;
  projectId?: string;
  onProgress?: (step: string) => void;
}

const VALID_COMPONENTS = ["service", "view", "rule", "skill", "memory"];

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end >= 0) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("No JSON in response");
}

function extractCode(text: string): string {
  const fenced = text.match(/```(?:tsx?|typescript|react)?\s*\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function buildSolution(opts: BuildSolutionOpts): Promise<BuildSolutionResult> {
  const { problem, name, onProgress } = opts;
  const id = randomUUID();
  const files: Array<{ path: string; content: string }> = [];
  const components: SolutionComponent[] = [];

  onProgress?.("Understanding your problem...");
  const archPrompt = solutionArchitectPrompt(problem, "");
  const archRes = await complete({
    system: SOLUTION_SYSTEM,
    prompt: archPrompt,
    maxTokens: 2048,
    temperature: 0,
  });
  const arch = extractJson(archRes.text) as {
    components?: string[];
    plan?: string;
    name_suggestion?: string;
  };
  const plan = arch.plan ?? "";
  const resolvedName = name || (arch.name_suggestion ?? "solution");
  const selectedComponents = (arch.components ?? []).filter((c) =>
    VALID_COMPONENTS.includes(c),
  );

  onProgress?.("Designing the solution...");

  const hasService = selectedComponents.includes("service");
  const servicePort = hasService ? 3000 : undefined;

  for (const compType of selectedComponents) {
    onProgress?.("Building components...");
    if (compType === "service") {
      const prompt = solutionServicePrompt(resolvedName, problem, plan);
      const res = await complete({
        system: SOLUTION_SYSTEM,
        prompt,
        maxTokens: 4096,
        temperature: 0,
      });
      const parsed = extractJson(res.text) as {
        index_ts?: string;
        routes_ts?: string;
        package_json?: string;
      };
      if (parsed.index_ts) files.push({ path: "server/index.ts", content: parsed.index_ts });
      if (parsed.routes_ts) files.push({ path: "server/routes.ts", content: parsed.routes_ts });
      if (parsed.package_json) files.push({ path: "package.json", content: parsed.package_json });
      components.push({ type: "service" });
    } else if (compType === "view") {
      const prompt = solutionViewPrompt(resolvedName, problem, plan, servicePort);
      const res = await complete({
        system: SOLUTION_SYSTEM,
        prompt,
        maxTokens: 4096,
        temperature: 0,
      });
      const code = extractCode(res.text);
      files.push({ path: "views/SolutionView.tsx", content: code });
      components.push({ type: "view" });
    } else if (compType === "rule") {
      const prompt = solutionRulePrompt(resolvedName, problem, plan);
      const res = await complete({
        system: SOLUTION_SYSTEM,
        prompt,
        maxTokens: 2048,
        temperature: 0,
      });
      files.push({ path: `rules/${resolvedName}.mdc`, content: res.text.trim() });
      components.push({ type: "rule" });
    } else if (compType === "skill") {
      const prompt = solutionSkillPrompt(resolvedName, problem, plan);
      const res = await complete({
        system: SOLUTION_SYSTEM,
        prompt,
        maxTokens: 2048,
        temperature: 0,
      });
      files.push({ path: `skills/${resolvedName}/SKILL.md`, content: res.text.trim() });
      components.push({ type: "skill" });
    } else if (compType === "memory") {
      const prompt = `Create a memory entry for: ${resolvedName}\n\nProblem: ${problem}\nPlan: ${plan}\n\nOutput markdown content only.`;
      const res = await complete({
        system: SOLUTION_SYSTEM,
        prompt,
        maxTokens: 1024,
        temperature: 0,
      });
      files.push({
        path: `memory/decisions/${resolvedName}.md`,
        content: res.text.trim(),
      });
      components.push({ type: "memory" });
    }
  }

  onProgress?.("Assembling...");

  return { id, name: resolvedName, problem, components, files };
}
