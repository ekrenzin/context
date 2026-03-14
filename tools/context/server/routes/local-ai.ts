import type { FastifyInstance } from "fastify";
import {
  isOllamaRunning,
  listModels,
  pullModel,
} from "../ai/ollama.js";
import { chat, runWithTools } from "../ai/tool-runner.js";
import { routePrompt } from "../ai/router.js";
import { listModelsWithCaps } from "../ai/model-caps.js";
import { complete } from "../ai/client.js";
import { getSetting, setSetting } from "../db/index.js";

export function registerLocalAiRoutes(app: FastifyInstance): void {
  app.get("/api/local-ai/status", async () => {
    const model = getSetting("ollama_model") ?? null;
    const running = await isOllamaRunning();
    const routingMode = getSetting("routing_mode") ?? "local-only";
    const hasCloudKey = !!(
      getSetting("anthropic_api_key") || getSetting("openai_api_key")
    );

    if (!running) {
      return {
        status: "offline",
        model,
        ollama: false,
        routingMode,
        hasCloudKey,
        tier: null,
        supportsTools: false,
      };
    }

    const models = await listModelsWithCaps();
    const active = models.find((m) => m.name === model);
    return {
      status: "online",
      model,
      ollama: true,
      routingMode,
      hasCloudKey,
      tier: active?.tier ?? null,
      supportsTools: active?.supportsTools ?? false,
    };
  });

  app.post<{
    Body: {
      prompt: string;
      maxTokens?: number;
      temperature?: number;
      tools?: boolean;
      route?: "local" | "cloud" | "auto";
    };
  }>("/api/local-ai/prompt", async (req, reply) => {
    const {
      prompt,
      maxTokens = 200,
      temperature = 0.7,
      tools = false,
      route,
    } = req.body ?? {};
    if (!prompt) {
      return reply.code(400).send({ ok: false, error: "Missing prompt" });
    }

    const modelName = getSetting("ollama_model") ?? null;
    const models = await listModels();
    const modelSize = models.find((m) => m.name === modelName)?.size ?? 0;

    const decision = await routePrompt(
      { maxTokens, tools, route },
      modelName,
      modelSize,
    );

    if (decision.backend === "cloud") {
      try {
        const result = await complete({ prompt, maxTokens, temperature });
        return {
          ok: true,
          response: result.text,
          backend: "cloud",
          provider: result.provider,
          reason: decision.reason,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ ok: false, error: msg });
      }
    }

    if (!modelName) {
      return reply
        .code(503)
        .send({ ok: false, error: "No model configured" });
    }
    if (!(await isOllamaRunning())) {
      return reply
        .code(503)
        .send({ ok: false, error: "Ollama not running" });
    }

    try {
      if (tools) {
        const result = await runWithTools({
          model: modelName,
          modelSize,
          messages: [{ role: "user", content: prompt }],
          tools: true,
          temperature,
          maxTokens,
        });
        return {
          ok: true,
          response: result.response,
          backend: "local",
          toolCalls: result.toolCalls.length,
          iterations: result.iterations,
          reason: decision.reason,
        };
      }

      const response = await chat(prompt, modelName, {
        temperature,
        maxTokens,
      });
      return {
        ok: true,
        response,
        backend: "local",
        reason: decision.reason,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: msg });
    }
  });

  // ── Model management ────────────────────────────────────────────

  app.get("/api/local-ai/models", async () => {
    const running = await isOllamaRunning();
    if (!running) return { models: [], active: null };

    const models = await listModelsWithCaps();
    const active = getSetting("ollama_model") ?? null;
    return { models, active };
  });

  app.put<{ Body: { model: string } }>(
    "/api/local-ai/model",
    async (req, reply) => {
      const { model } = req.body ?? {};
      if (!model) {
        return reply.code(400).send({ ok: false, error: "Missing model" });
      }
      setSetting("ollama_model", model);
      return { ok: true, model };
    },
  );

  app.post<{ Body: { model: string } }>(
    "/api/local-ai/pull",
    async (req, reply) => {
      const { model } = req.body ?? {};
      if (!model) {
        return reply.code(400).send({ ok: false, error: "Missing model" });
      }
      if (!(await isOllamaRunning())) {
        return reply
          .code(503)
          .send({ ok: false, error: "Ollama not running" });
      }
      try {
        await pullModel(model);
        return { ok: true, model };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ ok: false, error: msg });
      }
    },
  );

  // ── Routing config ──────────────────────────────────────────────

  app.get("/api/local-ai/routing", async () => {
    return {
      mode: getSetting("routing_mode") ?? "local-only",
      threshold: Number(getSetting("cloud_fallback_threshold")) || 1000,
      cloudProvider: getSetting("ai_provider") ?? null,
    };
  });

  app.put<{
    Body: {
      mode?: string;
      threshold?: number;
    };
  }>("/api/local-ai/routing", async (req, reply) => {
    const { mode, threshold } = req.body ?? {};
    if (mode) {
      if (!["local-only", "hybrid", "cloud-only"].includes(mode)) {
        return reply.code(400).send({
          ok: false,
          error: "Invalid mode. Use: local-only, hybrid, cloud-only",
        });
      }
      setSetting("routing_mode", mode);
    }
    if (threshold !== undefined) {
      setSetting("cloud_fallback_threshold", String(threshold));
    }
    return { ok: true };
  });
}
