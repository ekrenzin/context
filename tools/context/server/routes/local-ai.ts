import type { FastifyInstance } from "fastify";
import { generate, isOllamaRunning, listModels } from "../ai/ollama.js";
import { getSetting } from "../db/index.js";

export function registerLocalAiRoutes(app: FastifyInstance): void {
  app.get("/api/local-ai/status", async () => {
    const model = getSetting("ollama_model") ?? null;
    const running = await isOllamaRunning();
    return { status: running ? "online" : "offline", model, ollama: running };
  });

  app.post<{
    Body: { prompt: string; maxTokens?: number; temperature?: number };
  }>("/api/local-ai/prompt", async (req, reply) => {
    const { prompt, maxTokens = 200, temperature = 0.7 } = req.body ?? {};
    if (!prompt) return reply.code(400).send({ ok: false, error: "Missing prompt" });

    const model = getSetting("ollama_model");
    if (!model) return reply.code(503).send({ ok: false, error: "No model configured" });
    if (!(await isOllamaRunning())) {
      return reply.code(503).send({ ok: false, error: "Ollama not running" });
    }

    try {
      const response = await generate(prompt, model, { temperature, maxTokens });
      return { ok: true, response };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: msg });
    }
  });
}
