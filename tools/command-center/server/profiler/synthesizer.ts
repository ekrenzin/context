import { complete, skillEvolutionPrompt, memorySynthesisPrompt } from "../ai/index.js";
import { listSessions, insertLearning, insertApproval } from "../db/index.js";
import { listMemory } from "../db/index.js";
import crypto from "crypto";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end >= 0) return JSON.parse(text.slice(start, end + 1));

  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd >= 0) return JSON.parse(text.slice(arrStart, arrEnd + 1));

  throw new Error("No JSON in response");
}

export interface SkillEvolution {
  skillMd: string;
  resources: Array<{ path: string; content: string }>;
}

export async function synthesizeSkillEvolution(
  skillName: string,
  currentSkillMd: string,
  projectId?: string,
): Promise<SkillEvolution> {
  const sessions = listSessions({ limit: 20 });
  const relevant = sessions.filter((s) => {
    const skills: string[] = JSON.parse(s.skills);
    return skills.includes(skillName);
  });

  if (relevant.length === 0) {
    return { skillMd: currentSkillMd, resources: [] };
  }

  const analyses = relevant
    .filter((s) => s.analysis)
    .map((s) => JSON.parse(s.analysis!))
    .slice(0, 10);

  const response = await complete({
    prompt: skillEvolutionPrompt(currentSkillMd, JSON.stringify(analyses, null, 2)),
    maxTokens: 4096,
  });

  const result = extractJson(response.text) as { skill_md: string; resources: Array<{ path: string; content: string }> };

  insertLearning({
    id: `skill-evo-${skillName}-${crypto.randomBytes(4).toString("hex")}`,
    type: "evolution",
    source: skillName,
    content: result.skill_md,
    metadata: JSON.stringify({ resources: result.resources, sessionCount: relevant.length }),
  });

  if (projectId) {
    insertApproval({
      id: `apr-${crypto.randomBytes(6).toString("hex")}`,
      project_id: projectId,
      type: "skill_evolution",
      title: `Evolve skill: ${skillName}`,
      summary: `Based on ${relevant.length} session(s) using this skill`,
      diff: JSON.stringify({ skillName, skillMd: result.skill_md, resources: result.resources }),
      status: "pending",
    });
  }

  return { skillMd: result.skill_md, resources: result.resources };
}

export interface MemoryCandidate {
  category: string;
  filename: string;
  content: string;
}

export async function synthesizeMemory(projectId?: string): Promise<MemoryCandidate[]> {
  const sessions = listSessions({ limit: 20 });
  const analyzed = sessions.filter((s) => s.analysis);

  if (analyzed.length === 0) return [];

  const analyses = analyzed.map((s) => JSON.parse(s.analysis!)).slice(0, 10);
  const existing = listMemory({ limit: 200 });
  const existingIds = existing.map((m) => m.id);

  const response = await complete({
    prompt: memorySynthesisPrompt(
      JSON.stringify(analyses, null, 2),
      existingIds.join("\n"),
    ),
    maxTokens: 4096,
  });

  const candidates = extractJson(response.text) as MemoryCandidate[];

  for (const c of candidates) {
    const learnId = `mem-synth-${crypto.randomBytes(4).toString("hex")}`;

    insertLearning({
      id: learnId,
      type: "recommendation",
      source: "memory-synthesis",
      content: JSON.stringify(c),
      metadata: JSON.stringify({ category: c.category, filename: c.filename }),
    });

    if (projectId) {
      insertApproval({
        id: `apr-${crypto.randomBytes(6).toString("hex")}`,
        project_id: projectId,
        type: "memory_candidate",
        title: `New memory: ${c.filename}`,
        summary: `Category: ${c.category}`,
        diff: JSON.stringify({ category: c.category, filename: c.filename, content: c.content }),
        status: "pending",
      });
    }
  }

  return candidates;
}
