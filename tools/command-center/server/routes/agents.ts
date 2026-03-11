import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { AgentScheduler } from "../agent-scheduler.js";
import type { AgentJobType } from "../types.js";

interface MemoryCandidate {
  category: string;
  filename: string;
  content: string;
}

interface SkillResource {
  path: string;
  content: string;
}

interface SkillCandidate {
  skillName: string;
  skillDir: string;
  currentMd: string;
  skillMd: string;
  resources: SkillResource[];
  analysisCount: number;
}

interface AgentCandidate {
  agentName: string;
  skills: string[];
  frequency: number;
  confidence: number;
  triggerPhrases: string[];
  skillMd: string;
}

function candidatesPath(root: string): string {
  return path.join(root, "playground", "output", "memory-candidates.json");
}

function loadCandidates(root: string): MemoryCandidate[] {
  try {
    return JSON.parse(fs.readFileSync(candidatesPath(root), "utf8")) as MemoryCandidate[];
  } catch {
    return [];
  }
}

function skillCandidatesPath(root: string): string {
  return path.join(root, "playground", "output", "skill-candidates.json");
}

function loadSkillCandidates(root: string): SkillCandidate[] {
  try {
    return JSON.parse(fs.readFileSync(skillCandidatesPath(root), "utf8")) as SkillCandidate[];
  } catch {
    return [];
  }
}

function agentCandidatesPath(root: string): string {
  return path.join(root, "playground", "output", "agent-candidates.json");
}

function loadAgentCandidates(root: string): AgentCandidate[] {
  try {
    return JSON.parse(fs.readFileSync(agentCandidatesPath(root), "utf8")) as AgentCandidate[];
  } catch {
    return [];
  }
}

export function registerAgentRoutes(
  app: FastifyInstance,
  scheduler: AgentScheduler,
  root: string,
): void {
  app.get("/api/agents", async () => {
    return scheduler.getState();
  });

  app.post("/api/agents/trigger", async (_req, reply) => {
    scheduler.trigger();
    reply.code(202).send({ queued: true });
  });

  const VALID_JOB_TYPES = new Set<AgentJobType>([
    "profile-scan",
    "session-analysis",
    "codebase-scan",
    "memory-synthesis",
    "skill-evolution",
  ]);

  app.post<{ Params: { type: string } }>("/api/agents/trigger/:type", async (req, reply) => {
    const type = req.params.type as AgentJobType;
    if (!VALID_JOB_TYPES.has(type)) {
      reply.code(400).send({ error: `Unknown job type: ${type}` });
      return;
    }
    const queued = scheduler.triggerJob(type);
    reply.code(queued ? 202 : 409).send({ queued });
  });

  app.post<{
    Body: { repo: string; depth: string; focus?: string; runId: string };
  }>("/api/agents/trigger/intel-analysis", async (req, reply) => {
    const { repo, depth, focus, runId } = req.body ?? {} as Record<string, string>;
    if (!repo || !depth || !runId) {
      reply.code(400).send({ error: "repo, depth, and runId are required" });
      return;
    }
    const jobId = scheduler.triggerIntelJob({ repo, depth, focus, runId });
    reply.code(jobId ? 202 : 409).send({ queued: !!jobId, jobId });
  });

  app.post("/api/agents/cancel", async (_req, reply) => {
    scheduler.cancel();
    reply.code(202).send({ cancelled: true });
  });

  app.post<{ Params: { jobId: string } }>("/api/agents/cancel/:jobId", async (req, reply) => {
    const ok = scheduler.cancelJob(req.params.jobId);
    reply.code(ok ? 202 : 404).send({ cancelled: ok });
  });

  app.get("/api/agents/memory-candidates", async () => {
    return loadCandidates(root);
  });

  app.post<{ Body: MemoryCandidate }>("/api/agents/memory-candidates/promote", async (req, reply) => {
    const { category, filename, content } = req.body;
    const allowedCategories = ["decisions", "known-issues"];
    if (!allowedCategories.includes(category)) {
      reply.code(400).send({ error: "Only decisions and known-issues can be promoted." });
      return;
    }

    const dest = path.join(root, "memory", category, filename);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content + "\n");
    } catch (err) {
      reply.code(500).send({ error: String(err) });
      return;
    }

    const candidates = loadCandidates(root).filter((c) => c.filename !== filename);
    try {
      fs.writeFileSync(candidatesPath(root), JSON.stringify(candidates, null, 2));
    } catch { /* best effort */ }

    reply.send({ promoted: true, path: dest });
  });

  app.get("/api/agents/skill-candidates", async () => {
    return loadSkillCandidates(root);
  });

  app.post<{ Body: SkillCandidate }>("/api/agents/skill-candidates/apply", async (req, reply) => {
    const { skillName, skillDir, skillMd, resources } = req.body;
    if (!skillDir || !skillMd) {
      reply.code(400).send({ error: "skillDir and skillMd are required." });
      return;
    }

    const skillMdPath = path.join(root, skillDir, "SKILL.md");
    try {
      fs.mkdirSync(path.dirname(skillMdPath), { recursive: true });
      fs.writeFileSync(skillMdPath, skillMd + "\n");
    } catch (err) {
      reply.code(500).send({ error: String(err) });
      return;
    }

    for (const resource of resources ?? []) {
      if (!resource.path || !resource.content) continue;
      const dest = path.join(root, skillDir, resource.path.replace(/^\//, ""));
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, resource.content + "\n");
      } catch { /* best effort */ }
    }

    const remaining = loadSkillCandidates(root).filter((c) => c.skillName !== skillName);
    try {
      fs.writeFileSync(skillCandidatesPath(root), JSON.stringify(remaining, null, 2));
    } catch { /* best effort */ }

    reply.send({ applied: true, skillName });
  });

  app.post<{ Body: { skillName: string } }>("/api/agents/skill-candidates/dismiss", async (req, reply) => {
    const { skillName } = req.body;
    const remaining = loadSkillCandidates(root).filter((c) => c.skillName !== skillName);
    try {
      fs.writeFileSync(skillCandidatesPath(root), JSON.stringify(remaining, null, 2));
    } catch { /* best effort */ }
    reply.send({ dismissed: true, skillName });
  });

  app.get("/api/agents/agent-candidates", async () => {
    return loadAgentCandidates(root);
  });

  app.post<{ Body: AgentCandidate }>("/api/agents/agent-candidates/apply", async (req, reply) => {
    const { agentName, skillMd } = req.body;
    if (!agentName || !skillMd) {
      reply.code(400).send({ error: "agentName and skillMd are required." });
      return;
    }

    const dest = path.join(root, ".cursor", "skills", "agents", agentName, "SKILL.md");
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, skillMd + "\n");
    } catch (err) {
      reply.code(500).send({ error: String(err) });
      return;
    }

    const remaining = loadAgentCandidates(root).filter((c) => c.agentName !== agentName);
    try {
      fs.writeFileSync(agentCandidatesPath(root), JSON.stringify(remaining, null, 2));
    } catch { /* best effort */ }

    reply.send({ applied: true, agentName, path: dest });
  });

  app.post<{ Body: { agentName: string } }>("/api/agents/agent-candidates/dismiss", async (req, reply) => {
    const { agentName } = req.body;
    const remaining = loadAgentCandidates(root).filter((c) => c.agentName !== agentName);
    try {
      fs.writeFileSync(agentCandidatesPath(root), JSON.stringify(remaining, null, 2));
    } catch { /* best effort */ }
    reply.send({ dismissed: true, agentName });
  });
}
