import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { FastifyInstance } from "fastify";
import { getSetting } from "../db/index.js";
import type { AiProvider } from "../ai/client.js";

interface ModelOption {
  id: string;
  label: string;
  provider: AiProvider;
}

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

const AUTH_MODE_KEY: Record<string, string> = {
  anthropic: "claude_auth_mode",
  openai: "codex_auth_mode",
};

function resolveApiKey(provider: AiProvider): string | null {
  const fromSettings = getSetting(`${provider}_api_key`);
  if (fromSettings) return fromSettings;
  return process.env[ENV_KEY_MAP[provider]] ?? null;
}

function isProviderEnabled(provider: "anthropic" | "openai"): boolean {
  const mode = getSetting(AUTH_MODE_KEY[provider]);
  if (mode === "login") return true;
  if (mode === "api_key" && getSetting(`${provider}_api_key`)) return true;
  if (process.env[ENV_KEY_MAP[provider]]) return true;
  if (getSetting("ai_provider") === provider) return true;
  if (getSetting(`${provider}_api_key`)) return true;
  return false;
}

// -- Model cache (TTL-based) ------------------------------------------------

interface CacheEntry {
  models: ModelOption[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const modelCache: Record<string, CacheEntry> = {};

function humanLabel(id: string): string {
  return id
    .replace(/^claude-/, "Claude ")
    .replace(/^gpt-/, "GPT-")
    .replace(/-(\d)/g, " $1")
    .replace(/-/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelOption[]> {
  try {
    const client = new Anthropic({ apiKey });
    const page = await client.models.list({ limit: 100 });
    const models: ModelOption[] = [];
    for (const m of page.data) {
      models.push({
        id: m.id,
        label: m.display_name || humanLabel(m.id),
        provider: "anthropic",
      });
    }
    return latestPerTier(models);
  } catch {
    return FALLBACK_ANTHROPIC;
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  try {
    const client = new OpenAI({ apiKey });
    const page = await client.models.list();
    const models: ModelOption[] = [];
    for (const m of page.data) {
      // Filter to chat-capable models only
      if (!isChatModel(m.id)) continue;
      models.push({
        id: m.id,
        label: humanLabel(m.id),
        provider: "openai",
      });
    }
    return latestPerTier(models);
  } catch {
    return FALLBACK_OPENAI;
  }
}

function isChatModel(id: string): boolean {
  const prefixes = ["gpt-5", "gpt-4.1", "gpt-4o", "o1", "o3", "o4", "chatgpt"];
  const excluded = [
    "codex", "audio", "realtime", "tts", "transcribe",
    "search", "image", "instruct", "chat-latest",
  ];
  if (!prefixes.some((p) => id.startsWith(p))) return false;
  if (excluded.some((e) => id.includes(e))) return false;
  // Skip dated variants (e.g. gpt-5.4-2026-03-05) -- keep only canonical IDs
  if (/\d{4}-\d{2}-\d{2}$/.test(id)) return false;
  return true;
}

/**
 * Extract a tier key so all generations of the same role collapse together.
 * "gpt-5.4"       -> "gpt-flagship"
 * "gpt-5.4-pro"   -> "gpt-pro"
 * "gpt-5-mini"    -> "gpt-mini"
 * "gpt-4.1-nano"  -> "gpt-nano"
 * "o3-pro"        -> "o-pro"
 * "o4-mini"       -> "o-mini"
 * "o3"            -> "o-reasoning"
 * "claude-sonnet-4-6" -> "claude-sonnet"
 */
function modelTier(id: string): string {
  const anthropicMatch = id.match(/^(claude-[a-z]+)/);
  if (anthropicMatch) return anthropicMatch[1];

  const suffix = id.match(/-(mini|nano|pro)$/)?.[1];
  if (id.startsWith("o")) return suffix ? `o-${suffix}` : "o-reasoning";
  return suffix ? `gpt-${suffix}` : "gpt-flagship";
}

/** Keep only the latest model per tier. */
function latestPerTier(models: ModelOption[]): ModelOption[] {
  const tiers = new Map<string, ModelOption[]>();
  for (const m of models) {
    const tier = modelTier(m.id);
    const list = tiers.get(tier) ?? [];
    list.push(m);
    tiers.set(tier, list);
  }
  const result: ModelOption[] = [];
  for (const members of tiers.values()) {
    members.sort((a, b) => b.id.localeCompare(a.id));
    result.push(members[0]);
  }
  return result;
}

async function getCachedModels(provider: AiProvider): Promise<ModelOption[]> {
  const cached = modelCache[provider];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.models;
  }

  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    return provider === "anthropic" ? FALLBACK_ANTHROPIC : FALLBACK_OPENAI;
  }

  const fetcher = provider === "anthropic" ? fetchAnthropicModels : fetchOpenAIModels;
  const models = await fetcher(apiKey);
  modelCache[provider] = { models, fetchedAt: Date.now() };
  return models;
}

// -- Fallbacks (used when API is unreachable) --------------------------------

const FALLBACK_ANTHROPIC: ModelOption[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
];

const FALLBACK_OPENAI: ModelOption[] = [
  { id: "gpt-5.4", label: "GPT 5.4", provider: "openai" },
  { id: "gpt-5.4-pro", label: "GPT 5.4 Pro", provider: "openai" },
  { id: "o3", label: "o3", provider: "openai" },
  { id: "o4-mini", label: "o4 Mini", provider: "openai" },
];

// -- Route registration ------------------------------------------------------

async function getAvailableModels(): Promise<ModelOption[]> {
  const models: ModelOption[] = [];
  if (isProviderEnabled("anthropic")) {
    models.push(...await getCachedModels("anthropic"));
  }
  if (isProviderEnabled("openai")) {
    models.push(...await getCachedModels("openai"));
  }
  return models;
}

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
  model?: string;
}

export function registerAiRoutes(app: FastifyInstance): void {
  app.get("/api/ai/models", async () => {
    return { models: await getAvailableModels() };
  });

  app.post<{ Body: ChatBody }>("/api/ai/chat", async (req, reply) => {
    const { messages, model } = req.body ?? {};
    if (!messages?.length) {
      return reply.code(400).send({ error: "messages required" });
    }

    const available = await getAvailableModels();
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
        provider: selected.provider,
      });

      return { content: result.text, model: result.model, provider: result.provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: message });
    }
  });
}
