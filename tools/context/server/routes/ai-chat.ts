import type { FastifyInstance } from "fastify";
import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  appendMessage,
  getMessages,
} from "../db/queries/conversations.js";
import { runAgenticLoop } from "../ai/agentic.js";
import type { ToolCatalog } from "../ai/tool-catalog.js";
import { complete } from "../ai/client.js";

function sseWrite(raw: NodeJS.WritableStream, event: string, data: unknown): void {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function autoTitle(content: string, model?: string): Promise<string> {
  try {
    const res = await complete({
      prompt: `Summarize this user message as a short chat title (max 6 words, no quotes):\n\n${content.slice(0, 500)}`,
      maxTokens: 30,
      model,
    });
    return res.text.trim().replace(/^["']|["']$/g, "").slice(0, 80);
  } catch {
    return content.slice(0, 60);
  }
}

export function registerAiChatRoutes(app: FastifyInstance, catalog: ToolCatalog): void {
  app.post("/api/ai/conversations", async () => {
    return createConversation();
  });

  app.get("/api/ai/conversations", async () => {
    return listConversations();
  });

  app.get<{ Params: { id: string } }>("/api/ai/conversations/:id", async (req, reply) => {
    const conv = getConversation(req.params.id);
    if (!conv) return reply.code(404).send({ error: "Not found" });
    return { ...conv, messages: getMessages(conv.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/ai/conversations/:id", async (req, reply) => {
    const conv = getConversation(req.params.id);
    if (!conv) return reply.code(404).send({ error: "Not found" });
    deleteConversation(req.params.id);
    return { ok: true };
  });

  app.post<{
    Params: { id: string };
    Body: { content: string; model?: string };
  }>("/api/ai/conversations/:id/messages", async (req, reply) => {
    const conv = getConversation(req.params.id);
    if (!conv) return reply.code(404).send({ error: "Not found" });

    const { content, model } = req.body ?? {};
    if (!content?.trim()) return reply.code(400).send({ error: "content required" });

    appendMessage(conv.id, "user", content);
    if (model) updateConversation(conv.id, { model });

    const history = getMessages(conv.id);
    const apiMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let fullText = "";
    const toolCalls: Array<{ id: string; name: string; args: unknown; result?: string }> = [];

    try {
      await runAgenticLoop({
        messages: apiMessages,
        model: model ?? conv.model ?? undefined,
        catalog,
        onEvent(event) {
          if (raw.destroyed) return;
          switch (event.type) {
            case "text_delta":
              fullText += event.text;
              sseWrite(raw, "text_delta", { text: event.text });
              break;
            case "tool_call":
              toolCalls.push({ id: event.id, name: event.name, args: event.args });
              sseWrite(raw, "tool_call", event);
              break;
            case "tool_result": {
              const tc = toolCalls.find((t) => t.id === event.id);
              if (tc) tc.result = event.result;
              sseWrite(raw, "tool_result", event);
              break;
            }
            case "done":
              sseWrite(raw, "done", { inputTokens: event.inputTokens, outputTokens: event.outputTokens });
              break;
            case "error":
              sseWrite(raw, "error", { message: event.message });
              break;
          }
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!raw.destroyed) sseWrite(raw, "error", { message });
    }

    if (fullText) {
      appendMessage(conv.id, "assistant", fullText, toolCalls.length > 0 ? toolCalls : undefined);
    }

    if (!conv.title && fullText) {
      const title = await autoTitle(content, model ?? conv.model ?? undefined);
      updateConversation(conv.id, { title });
      if (!raw.destroyed) sseWrite(raw, "title", { title });
    }

    raw.end();
  });
}
