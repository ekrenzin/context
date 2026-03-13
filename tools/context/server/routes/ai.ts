import type { FastifyInstance } from "fastify";
import { getSetting } from "../db/index.js";
import type { AiProvider } from "../ai/client.js";

interface ModelOption {
  id: string;
  label: string;
  provider: AiProvider;
}

const ANTHROPIC_MODELS: ModelOption[] = [
  { id: "claude-opus-4-20250514", label: "Claude Opus 4", provider: "anthropic" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic" },
  { id: "claude-haiku-4-20250514", label: "Claude Haiku 4", provider: "anthropic" },
];

const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "o3", label: "o3", provider: "openai" },
  { id: "o3-mini", label: "o3-mini", provider: "openai" },
  { id: "o4-mini", label: "o4-mini", provider: "openai" },
];

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

const AUTH_MODE_KEY: Record<string, string> = {
  anthropic: "claude_auth_mode",
  openai: "codex_auth_mode",
};

function isProviderEnabled(provider: "anthropic" | "openai"): boolean {
  const mode = getSetting(AUTH_MODE_KEY[provider]);
  // Login flow is configured for this provider
  if (mode === "login") return true;
  // API key mode with a key stored in settings
  if (mode === "api_key" && getSetting(`${provider}_api_key`)) return true;
  // API key in environment
  if (process.env[ENV_KEY_MAP[provider]]) return true;
  // Is the selected ai_provider
  if (getSetting("ai_provider") === provider) return true;
  // Has an API key in settings even without explicit mode
  if (getSetting(`${provider}_api_key`)) return true;
  return false;
}

function getAvailableModels(): ModelOption[] {
  const models: ModelOption[] = [];
  if (isProviderEnabled("anthropic")) models.push(...ANTHROPIC_MODELS);
  if (isProviderEnabled("openai")) models.push(...OPENAI_MODELS);
  return models;
}

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
  model?: string;
}

export function registerAiRoutes(app: FastifyInstance): void {
  app.get("/api/ai/models", async () => {
    return { models: getAvailableModels() };
  });

  app.post<{ Body: ChatBody }>("/api/ai/chat", async (req, reply) => {
    const { messages, model } = req.body ?? {};
    if (!messages?.length) {
      return reply.code(400).send({ error: "messages required" });
    }

    const available = getAvailableModels();
    if (available.length === 0) {
      return reply.code(400).send({ error: "No AI provider configured -- set an API key first" });
    }

    const selected = model
      ? available.find((m) => m.id === model)
      : available[0];

    if (!selected) {
      return reply.code(400).send({ error: `Model "${model}" not available` });
    }

    try {
      const { complete } = await import("../ai/client.js");
      const lastUser = messages.filter((m) => m.role === "user").pop();
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");

      const result = await complete({
        prompt: lastUser?.content ?? "",
        system: system || undefined,
        model: selected.id,
      });

      return { content: result.text, model: result.model, provider: result.provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: message });
    }
  });
}
