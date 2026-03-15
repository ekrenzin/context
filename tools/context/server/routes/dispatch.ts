import path from "path";
import type { FastifyInstance } from "fastify";
import { classifyRequest } from "../ai/classifier.js";
import type { ClassificationResult } from "../ai/classifier.js";
import { logDispatch, analyzeDispatch } from "../ai/analyzer.js";
import { listDispatchLog } from "../db/queries/dispatch-log.js";
import { loadSkillGraph } from "./skills.js";
import { loadRepos } from "./repos.js";
import { queryRelevantMemory } from "../ai/memory-context.js";
import type { MemoryContext } from "../ai/memory-context.js";

export interface DispatchPayload {
  command: string;
  args: string[];
  prompt: string;
  skills: string[];
  repo: string | null;
  cwd: string;
  analysis: ClassificationResult;
  memoryContext: MemoryContext | null;
}

function composeCommand(
  input: string,
  classification: ClassificationResult,
  root: string,
  memoryContext: MemoryContext | null,
): DispatchPayload {
  const agent = classification.agent;
  const command = agent === "codex" ? "codex" : "claude";
  const args: string[] = [];

  if (command === "claude") {
    args.push("--dangerously-skip-permissions");
  }

  const cwd = classification.repo
    ? path.join(root, "repos", classification.repo)
    : root;

  const contextParts: string[] = [];
  if (classification.skills.length > 0) {
    contextParts.push(
      `Relevant skills: ${classification.skills.join(", ")}`,
    );
  }
  if (classification.repo) {
    contextParts.push(`Target repo: ${classification.repo}`);
  }

  const promptParts: string[] = [];
  if (contextParts.length > 0) {
    promptParts.push(`${contextParts.join(". ")}.`);
  }
  if (memoryContext?.summary) {
    promptParts.push(memoryContext.summary);
  }
  promptParts.push(input);

  return {
    command,
    args,
    prompt: promptParts.join("\n\n"),
    skills: classification.skills,
    repo: classification.repo,
    cwd,
    analysis: classification,
    memoryContext,
  };
}

export function registerDispatchRoutes(
  app: FastifyInstance,
  root: string,
): void {
  app.post<{ Body: { input: string; agent?: string } }>(
    "/api/ai/dispatch",
    async (req, reply) => {
      const { input, agent } = req.body ?? {};
      if (!input?.trim()) {
        return reply.code(400).send({ error: "input is required" });
      }

      const graph = loadSkillGraph(root);
      const repos = loadRepos(root);
      const repoInfos = repos.map((r) => ({
        name: r.name,
        description: r.description,
        present: r.present,
      }));

      const classification = await classifyRequest(
        input,
        graph.nodes,
        repoInfos,
      );

      if (agent === "claude" || agent === "codex") {
        classification.agent = agent;
      }

      const memoryContext = await queryRelevantMemory(input, classification);

      return composeCommand(input, classification, root, memoryContext);
    },
  );

  app.post<{ Body: { input: string; payload: DispatchPayload } }>(
    "/api/ai/analyze",
    async (req, reply) => {
      const { input, payload } = req.body ?? {};
      if (!input || !payload) {
        return reply.code(400).send({
          error: "input and payload are required",
        });
      }

      const id = logDispatch(input, payload);

      // Fire-and-forget: run analysis in background
      analyzeDispatch(id, input, payload, root).catch((err) => {
        console.error("[analyze] background analysis failed:", err);
      });

      return reply.code(202).send({
        id,
        status: "accepted",
        intent: payload.analysis.intent,
        skills: payload.analysis.skills,
      });
    },
  );

  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/api/ai/dispatch/history",
    async (req) => {
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50),
      );
      const offset = Math.max(
        0,
        parseInt(req.query.offset ?? "0", 10) || 0,
      );

      const rows = listDispatchLog(limit, offset);

      return rows.map((row) => ({
        id: row.id,
        input: row.input,
        intent: row.intent,
        confidence: row.confidence,
        skills: JSON.parse(row.skills),
        repo: row.repo,
        agent: row.agent,
        command: row.command,
        crossRepo: Boolean(row.cross_repo),
        crossRepoDetail: row.cross_repo_detail,
        skillGaps: row.skill_gaps ? JSON.parse(row.skill_gaps) : null,
        memoryUpdated: Boolean(row.memory_updated),
        analysisStatus: row.analysis_status,
        analysisError: row.analysis_error,
        createdAt: row.created_at,
        analyzedAt: row.analyzed_at,
      }));
    },
  );
}
