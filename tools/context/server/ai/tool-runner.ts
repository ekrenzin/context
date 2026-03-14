/**
 * Tool-use loop for the local Ollama model.
 *
 * Sends a prompt to Ollama's /api/chat endpoint with tool definitions.
 * When the model responds with tool calls, executes them and re-sends
 * the conversation until the model produces a final text response.
 */

import { getToolDefinitions, executeTool, loadBuiltinTools } from "./tools/index.js";
import type { ToolDefinition } from "./tools/index.js";

const toolsReady = loadBuiltinTools();
import { detectCapabilities } from "./model-caps.js";

const BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MAX_ITERATIONS = 10;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolRunnerOptions {
  model: string;
  modelSize: number;
  messages: ChatMessage[];
  tools?: boolean;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
}

export interface ToolRunnerResult {
  response: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  iterations: number;
}

async function ollamaChat(
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  temperature: number,
  maxTokens: number,
): Promise<{ message: ChatMessage }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: { temperature, num_predict: maxTokens },
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  });
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`Ollama chat failed: ${res.status}`);
  }
  return res.json();
}

export async function runWithTools(opts: ToolRunnerOptions): Promise<ToolRunnerResult> {
  await toolsReady;
  const caps = detectCapabilities(opts.model, opts.modelSize);
  const useTools = opts.tools !== false && caps.supportsTools;
  const toolDefs = useTools ? getToolDefinitions() : undefined;
  const maxIter = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? caps.maxUsefulTokens;

  const messages = [...opts.messages];
  const toolCallLog: ToolRunnerResult["toolCalls"] = [];
  let iterations = 0;

  while (iterations < maxIter) {
    iterations++;
    const { message } = await ollamaChat(
      opts.model,
      messages,
      toolDefs,
      temperature,
      maxTokens,
    );

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        response: message.content ?? "",
        toolCalls: toolCallLog,
        iterations,
      };
    }

    // Add assistant message with tool calls
    messages.push(message);

    // Execute each tool call
    for (const call of message.tool_calls) {
      const { name, arguments: args } = call.function;
      const result = await executeTool(name, args);
      const resultText = result.ok
        ? result.output ?? "(empty result)"
        : `Error: ${result.error}`;

      toolCallLog.push({ name, args, result: resultText });
      messages.push({
        role: "tool",
        content: resultText,
      });
    }
  }

  // Hit iteration limit -- return whatever we have
  const lastAssistant = messages
    .filter((m) => m.role === "assistant")
    .pop();
  return {
    response: lastAssistant?.content ?? "(max tool iterations reached)",
    toolCalls: toolCallLog,
    iterations,
  };
}

/**
 * Simple chat without tools -- replacement for the old generate() function.
 * Uses /api/chat instead of /api/generate for consistency.
 */
export async function chat(
  prompt: string,
  model: string,
  opts?: { temperature?: number; maxTokens?: number; system?: string },
): Promise<string> {
  const messages: ChatMessage[] = [];
  if (opts?.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: prompt });

  const { message } = await ollamaChat(
    model,
    messages,
    undefined,
    opts?.temperature ?? 0.8,
    opts?.maxTokens ?? 20,
  );
  return message.content ?? "";
}
