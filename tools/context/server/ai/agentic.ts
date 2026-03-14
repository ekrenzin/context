import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "../db/index.js";
import { getRateLimiter } from "./limiter.js";
import type { ToolCatalog } from "./tool-catalog.js";
import { buildSystemPrompt } from "./system-prompt.js";

export type AgenticEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "done"; text: string; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string };

export interface AgenticOpts {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  catalog: ToolCatalog;
  maxIterations?: number;
  onEvent: (event: AgenticEvent) => void;
}

const MAX_ITER = 10;
const DEFAULT_MODEL = "claude-sonnet-4-6";

function resolveApiKey(): string {
  const key = getSetting("anthropic_api_key");
  if (!key) throw new Error("No Anthropic API key configured");
  return key;
}

export async function runAgenticLoop(opts: AgenticOpts): Promise<void> {
  const { onEvent } = opts;
  const apiKey = resolveApiKey();
  const client = new Anthropic({ apiKey });
  const model = opts.model ?? DEFAULT_MODEL;
  const maxIter = opts.maxIterations ?? MAX_ITER;
  const system = buildSystemPrompt(opts.catalog.summaries());
  const tools = opts.catalog.definitions() as Anthropic.Tool[];

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const limiter = getRateLimiter();
  let totalInput = 0;
  let totalOutput = 0;
  let fullText = "";

  for (let iter = 0; iter < maxIter; iter++) {
    await limiter.acquire("anthropic");

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    });

    stream.on("text", (text) => {
      fullText += text;
      onEvent({ type: "text_delta", text });
    });

    const final = await stream.finalMessage();
    totalInput += final.usage.input_tokens;
    totalOutput += final.usage.output_tokens;
    limiter.record("anthropic", final.usage.input_tokens, final.usage.output_tokens);

    const toolBlocks = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (final.stop_reason !== "tool_use" || toolBlocks.length === 0) {
      onEvent({ type: "done", text: fullText, inputTokens: totalInput, outputTokens: totalOutput });
      return;
    }

    messages.push({ role: "assistant", content: final.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolBlocks) {
      const args = block.input as Record<string, unknown>;
      onEvent({ type: "tool_call", id: block.id, name: block.name, args });
      const result = await opts.catalog.execute(block.name, args);
      onEvent({ type: "tool_result", id: block.id, name: block.name, result });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }

    messages.push({ role: "user", content: toolResults });
  }

  onEvent({ type: "error", message: "Max tool iterations reached" });
}
