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
    return latestPerFamily(models);
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
    return latestPerFamily(models);
  } catch {
    return FALLBACK_OPENAI;
  }
}

function isChatModel(id: string): boolean {
  const prefixes = ["gpt-4", "gpt-3.5", "o1", "o3", "o4", "chatgpt"];
  return prefixes.some((p) => id.startsWith(p)) && !id.includes("instruct");
}

/**
 * Extract model family from an ID.
 * "claude-sonnet-4-6"          -> "claude-sonnet"
 * "claude-sonnet-4-20250514"   -> "claude-sonnet"
 * "gpt-4o-mini-2024-07-18"    -> "gpt-4o-mini"
 * "o3-mini"                    -> "o3-mini"
 * "o4-mini-2025-04-16"        -> "o4-mini"
 */
function modelFamily(id: string): string {
  // Anthropic: claude-<tier>-<version>[-date]
  const anthropicMatch = id.match(/^(claude-[a-z]+)/);
  if (anthropicMatch) return anthropicMatch[1];

  // OpenAI: strip trailing date stamps (-YYYY-MM-DD) and version suffixes
  return id.replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-\d{4,}$/, "");
}

/** Keep only the latest N models per family. */
function latestPerFamily(models: ModelOption[], n = 2): ModelOption[] {
  const families = new Map<string, ModelOption[]>();
  for (const m of models) {
    const fam = modelFamily(m.id);
    const list = families.get(fam) ?? [];
    list.push(m);
    families.set(fam, list);
  }
  const result: ModelOption[] = [];
  for (const members of families.values()) {
    // Sort newest first (higher ID = newer for both providers)
    members.sort((a, b) => b.id.localeCompare(a.id));
    result.push(...members.slice(0, n));
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
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "o3", label: "o3", provider: "openai" },
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
      });

      return { content: result.text, model: result.model, provider: result.provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: message });
    }
  });
}
