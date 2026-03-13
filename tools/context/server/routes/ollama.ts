import type { FastifyInstance } from "fastify";
import {
  isOllamaInstalled,
  isOllamaRunning,
  ollamaVersion,
  listModels,
  installOllama,
  pullModel,
  ensureServing,
  generate,
} from "../ai/ollama.js";

export function registerOllamaRoutes(app: FastifyInstance): void {
  app.get("/api/ollama/status", async () => {
    const installed = isOllamaInstalled();
    if (!installed) {
      return { installed: false, running: false, version: null, models: [] };
    }
    let running = await isOllamaRunning();
    if (!running) {
      try {
        await ensureServing();
        running = true;
      } catch {
        running = false;
      }
    }
    const version = ollamaVersion();
    const models = running ? await listModels() : [];
    return { installed, running, version, models };
  });

  app.post("/api/ollama/install", async () => {
    const result = await installOllama();
    return result;
  });

  app.post<{ Body: { model: string } }>("/api/ollama/pull", async (req, reply) => {
    const { model } = req.body ?? {};
    if (!model) return reply.code(400).send({ error: "Missing model" });
    try {
      await ensureServing();
      await pullModel(model);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: message });
    }
  });

  app.post<{ Body: { model: string } }>("/api/ollama/test", async (req, reply) => {
    const { model } = req.body ?? {};
    if (!model) return reply.code(400).send({ error: "Missing model" });
    try {
      await ensureServing();
      const start = Date.now();
      const result = await generate(
        "Name this terminal session in 2-3 creative words.\nCommand: node\nDirectory: api\nReply with ONLY the name, nothing else.",
        model,
        { temperature: 0.8, maxTokens: 20 },
      );
      const latency = Date.now() - start;
      return { ok: true, result: result.trim(), latency };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: message });
    }
  });
}
