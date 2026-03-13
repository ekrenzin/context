import fs from "fs";
import path from "path";
import { complete, scaffoldPrompt } from "../ai/index.js";

interface ScaffoldInput {
  name: string;
  projectType: string;
  description: string;
  goals: string[];
  repos: Array<{ name: string; url?: string }>;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end >= 0) return JSON.parse(text.slice(start, end + 1));
  throw new Error("No JSON in response");
}

export async function scaffoldIntelligence(
  rootPath: string,
  input: ScaffoldInput,
): Promise<void> {
  const prompt = scaffoldPrompt(
    input.name,
    input.projectType,
    input.description,
    input.goals,
    input.repos,
  );

  const response = await complete({ prompt, maxTokens: 4096, temperature: 0 });
  const result = extractJson(response.text) as {
    rules: Array<{ name: string; content: string }>;
    skills: Array<{ name: string; content: string }>;
    memory: Array<{ category: string; filename: string; content: string }>;
  };

  for (const rule of result.rules ?? []) {
    const rulesDir = path.join(rootPath, "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    const filename = rule.name.endsWith(".md") ? rule.name : `${rule.name}.md`;
    fs.writeFileSync(path.join(rulesDir, filename), rule.content, "utf-8");
  }

  for (const skill of result.skills ?? []) {
    const skillDir = path.join(rootPath, "skills", skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill.content, "utf-8");
  }

  for (const mem of result.memory ?? []) {
    const memDir = path.join(rootPath, "memory", mem.category);
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, mem.filename), mem.content, "utf-8");
  }
}
