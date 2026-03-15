import path from "path";
import type { FastifyInstance } from "fastify";
import { classifyRequest } from "../ai/classifier.js";
import type { ClassificationResult } from "../ai/classifier.js";
import { loadSkillGraph } from "./skills.js";
import { loadRepos } from "./repos.js";

export interface DispatchPayload {
  command: string;
  args: string[];
  prompt: string;
  skills: string[];
  repo: string | null;
  cwd: string;
  analysis: ClassificationResult;
}

function composeCommand(
  input: string,
  classification: ClassificationResult,
  root: string,
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
    contextParts.push(`Relevant skills: ${classification.skills.join(", ")}`);
  }
  if (classification.repo) {
    contextParts.push(`Target repo: ${classification.repo}`);
  }

  const prompt = contextParts.length > 0
    ? `${contextParts.join(". ")}.\n\n${input}`
    : input;

  return {
    command,
    args,
    prompt,
    skills: classification.skills,
    repo: classification.repo,
    cwd,
    analysis: classification,
  };
}

export function registerDispatchRoutes(app: FastifyInstance, root: string): void {
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

      const classification = await classifyRequest(input, graph.nodes, repoInfos);

      if (agent === "claude" || agent === "codex") {
        classification.agent = agent;
      }

      return composeCommand(input, classification, root);
    },
  );

  app.post<{ Body: { input: string; dispatch: DispatchPayload } }>(
    "/api/ai/analyze",
    async (req, reply) => {
      const { input, dispatch } = req.body ?? {};
      if (!input || !dispatch) {
        return reply.code(400).send({ error: "input and dispatch are required" });
      }

      // Fire-and-forget analysis -- stub for now, returns immediately
      return {
        ok: true,
        logged: true,
        intent: dispatch.analysis.intent,
        skills: dispatch.analysis.skills,
      };
    },
  );
}
