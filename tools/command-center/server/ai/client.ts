import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getRateLimiter } from "./limiter.js";
import { getSetting } from "../db/index.js";

export type AiProvider = "anthropic" | "openai";

export interface AiResponse {
  text: string;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiRequestOptions {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

function resolveApiKey(provider: AiProvider): string {
  const key = getSetting(`${provider}_api_key`);
  if (!key) throw new Error(`No API key configured for ${provider}`);
  return key;
}

function resolveProvider(): AiProvider {
  const pref = getSetting("ai_provider") as AiProvider | undefined;
  if (pref && (pref === "anthropic" || pref === "openai")) return pref;
  if (getSetting("anthropic_api_key")) return "anthropic";
  if (getSetting("openai_api_key")) return "openai";
  throw new Error("No AI provider configured -- set an API key first");
}

async function callAnthropic(opts: AiRequestOptions, apiKey: string): Promise<AiResponse> {
  const client = new Anthropic({ apiKey });
  const model = opts.model ?? DEFAULT_MODELS.anthropic;

  const msg = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0,
    system: opts.system ?? "",
    messages: [{ role: "user", content: opts.prompt }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  return {
    text,
    provider: "anthropic",
    model,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}

async function callOpenAI(opts: AiRequestOptions, apiKey: string): Promise<AiResponse> {
  const client = new OpenAI({ apiKey });
  const model = opts.model ?? DEFAULT_MODELS.openai;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0,
    messages,
  });

  return {
    text: res.choices[0]?.message?.content ?? "",
    provider: "openai",
    model,
    inputTokens: res.usage?.prompt_tokens ?? 0,
    outputTokens: res.usage?.completion_tokens ?? 0,
  };
}

export async function complete(opts: AiRequestOptions): Promise<AiResponse> {
  const provider = resolveProvider();
  const apiKey = resolveApiKey(provider);

  const limiter = getRateLimiter();
  await limiter.acquire(provider);

  const dispatch = provider === "anthropic" ? callAnthropic : callOpenAI;
  const result = await dispatch(opts, apiKey);

  limiter.record(provider, result.inputTokens, result.outputTokens);
  return result;
}

export async function testKey(provider: AiProvider, apiKey: string): Promise<string> {
  const opts: AiRequestOptions = {
    prompt: "Respond with only the word 'ok'.",
    maxTokens: 8,
  };

  const dispatch = provider === "anthropic" ? callAnthropic : callOpenAI;
  const result = await dispatch(opts, apiKey);
  return result.model;
}
