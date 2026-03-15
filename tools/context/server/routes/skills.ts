import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { SkillNode, SkillEdge, SkillGraph } from "../types.js";

const CATEGORIES: Record<string, string> = {
  "action-ticket": "lifecycle",
  "create-ticket": "lifecycle",
  "feature-dev": "lifecycle",
  "finish-ticket": "lifecycle",
  "preflight": "lifecycle",
  "code-review": "quality",
  "security-audit": "quality",
  "refactoring": "quality",
  "modular-design": "quality",
  "file-analysis": "quality",
  "cross-repo-check": "quality",
  "memory": "memory",
  "retrospective": "memory",
  "proactive-suggestions": "memory",
  "contribute": "memory",
  "git-ops": "devtools",
  "commit-format": "devtools",
  "database-ops": "devtools",
  "deploy": "devtools",
  "debug": "devtools",
  "cloudwatch-logs": "platform",
  "guardduty": "platform",
  "api-design": "platform",
  "start-platform": "platform",
  "dev-tunnel": "platform",
  "staging-test": "platform",
  "command-center": "platform",
  "teams-notify": "comms",
  "md-to-teams": "comms",
  "pr-summary": "comms",
  "frontend-patterns": "comms",
};

interface FrontMatter {
  description: string;
  triggers: string[];
  related_skills: string[];
}

function parseFrontMatter(content: string): FrontMatter {
  const result: FrontMatter = { description: "", triggers: [], related_skills: [] };

  const block = content.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return result;

  const yaml = block[1];

  const desc = yaml.match(/^description:\s*(.+)/m);
  if (desc) result.description = desc[1].trim();

  result.triggers = parseYamlList(yaml, "triggers");
  result.related_skills = parseYamlList(yaml, "related_skills");

  return result;
}

function parseYamlList(yaml: string, key: string): string[] {
  const inline = yaml.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)]`, "m"));
  if (inline) {
    const val = inline[1].trim();
    return val ? val.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")) : [];
  }

  const block = yaml.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-[^\\n]*\\n?)*)`, "m"));
  if (block) {
    return block[1]
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

export function loadSkillGraph(root: string): SkillGraph {
  const skillsDir = path.join(root, ".cursor", "skills");

  let skillDirs: string[] = [];
  try {
    skillDirs = fs
      .readdirSync(skillsDir)
      .filter((d) => fs.existsSync(path.join(skillsDir, d, "SKILL.md")));
  } catch {
    return { nodes: [], edges: [] };
  }

  const skillSet = new Set(skillDirs);
  const nodes: SkillNode[] = [];
  const edgeSet = new Set<string>();
  const edges: SkillEdge[] = [];

  for (const skill of skillDirs) {
    let content = "";
    try {
      content = fs.readFileSync(path.join(skillsDir, skill, "SKILL.md"), "utf8");
    } catch {
      continue;
    }

    const fm = parseFrontMatter(content);

    nodes.push({
      id: skill,
      description: fm.description,
      category: CATEGORIES[skill] ?? "unknown",
      relatedSkills: fm.related_skills.filter((r) => skillSet.has(r) && r !== skill),
    });

    for (const target of fm.triggers) {
      if (!skillSet.has(target) || target === skill) continue;
      const key = `trigger|${skill}|${target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: skill, target, type: "trigger" });
      }
    }

    for (const target of fm.related_skills) {
      if (!skillSet.has(target) || target === skill) continue;
      const key = [skill, target].sort().join("|related|");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: skill, target, type: "related" });
      }
    }
  }

  return { nodes, edges };
}

const VALID_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function registerSkillRoutes(app: FastifyInstance, root: string): void {
  const skillsDir = path.join(root, ".cursor", "skills");

  app.get("/api/skills/graph", async () => loadSkillGraph(root));

  app.post<{ Body: { name: string; description: string; category?: string; content?: string } }>(
    "/api/skills",
    async (req, reply) => {
      const { name, description, category, content } = req.body;
      if (!name || !VALID_NAME.test(name)) {
        return reply.code(400).send({ error: "Invalid name: lowercase letters, numbers, hyphens only" });
      }
      if (!description) {
        return reply.code(400).send({ error: "Description is required" });
      }

      const dir = path.join(skillsDir, name);
      if (fs.existsSync(dir)) {
        return reply.code(409).send({ error: "Skill already exists" });
      }

      const body = content ?? `# ${name}\n\nTODO: Add skill instructions here.\n`;
      const md = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "SKILL.md"), md, "utf-8");

      if (category && CATEGORIES[name] === undefined) {
        CATEGORIES[name] = category;
      }

      return { ok: true, name };
    },
  );

  app.delete<{ Params: { name: string } }>(
    "/api/skills/:name",
    async (req, reply) => {
      const dir = path.join(skillsDir, req.params.name);
      if (!fs.existsSync(dir)) {
        return reply.code(404).send({ error: "Skill not found" });
      }
      fs.rmSync(dir, { recursive: true });
      return { ok: true };
    },
  );
}
