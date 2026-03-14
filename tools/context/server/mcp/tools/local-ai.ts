import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { isOllamaRunning, listModels } from "../../ai/ollama.js";
import { chat, runWithTools } from "../../ai/tool-runner.js";
import { routePrompt } from "../../ai/router.js";
import { listModelsWithCaps } from "../../ai/model-caps.js";
import { complete } from "../../ai/client.js";
import { getSetting, setSetting } from "../../db/index.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { mqttClient } = deps;

  server.tool(
    "cc_local_ai_prompt",
    "Send a prompt to the local AI (with optional tool use and hybrid routing). Only use when the user explicitly asks for local/offline AI. Do NOT use this for content generation -- you are already a capable language model.",
    {
      prompt: z.string().describe("The prompt to send"),
      maxTokens: z.number().int().default(200).describe("Max tokens to generate"),
      temperature: z.number().default(0.7).describe("Sampling temperature (0-1)"),
      tools: z.boolean().default(false).describe("Enable tool use (web fetch, search, file read, grep, glob)"),
      route: z.enum(["local", "cloud", "auto"]).default("auto").describe("Routing: local (Ollama only), cloud (API only), auto (hybrid)"),
    },
    async ({ prompt, maxTokens, temperature, tools, route }) => {
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
            content: [{
              type: "text" as const,
              text: `[cloud/${result.provider}] ${result.text}`,
            }],
          };
        } catch (err) {
          return {
            content: [{
              type: "text" as const,
              text: `Cloud error: ${err instanceof Error ? err.message : String(err)}`,
            }],
            isError: true,
          };
        }
      }

      if (!modelName) {
        return {
          content: [{ type: "text" as const, text: "No local model configured. Set ollama_model in settings." }],
          isError: true,
        };
      }
      if (!(await isOllamaRunning())) {
        return {
          content: [{ type: "text" as const, text: "Ollama is not running." }],
          isError: true,
        };
      }

      if (tools) {
        const result = await runWithTools({
          model: modelName,
          modelSize,
          messages: [{ role: "user", content: prompt }],
          tools: true,
          temperature,
          maxTokens,
        });
        const meta = result.toolCalls.length > 0
          ? `\n[${result.toolCalls.length} tool calls, ${result.iterations} iterations]`
          : "";
        return {
          content: [{ type: "text" as const, text: result.response + meta }],
        };
      }

      const response = await chat(prompt, modelName, { temperature, maxTokens });
      return {
        content: [{ type: "text" as const, text: response }],
      };
    },
  );

  server.tool(
    "cc_local_ai_status",
    "Check local AI status: model, tier, tool support, routing mode, Ollama health, MQTT",
    {},
    async () => {
      const model = getSetting("ollama_model") ?? "(none)";
      const running = await isOllamaRunning();
      const mqttOk = mqttClient.connected();
      const routingMode = getSetting("routing_mode") ?? "local-only";
      const hasCloudKey = !!(getSetting("anthropic_api_key") || getSetting("openai_api_key"));

      const lines = [
        `Model: ${model}`,
        `Ollama: ${running ? "running" : "stopped"}`,
        `MQTT: ${mqttOk ? "connected" : "disconnected"}`,
        `Routing: ${routingMode}`,
        `Cloud API key: ${hasCloudKey ? "configured" : "not set"}`,
      ];

      if (running) {
        const models = await listModelsWithCaps();
        const active = models.find((m) => m.name === model);
        if (active) {
          lines.push(`Tier: ${active.tier}`);
          lines.push(`Tool use: ${active.supportsTools ? "supported" : "not supported"}`);
        }
        lines.push(
          `Available models: ${models.map((m) => `${m.name} (${m.tier})`).join(", ") || "(none)"}`,
        );
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_local_ai_mqtt_prompt",
    "Send a prompt to the local AI via MQTT (fire-and-forget). Reply arrives on the replyTo topic. Supports tool use and routing.",
    {
      prompt: z.string().describe("The prompt to send"),
      replyTo: z.string().default("ctx/local-ai/reply").describe("MQTT topic for the reply"),
      maxTokens: z.number().int().default(200).describe("Max tokens"),
      temperature: z.number().default(0.7).describe("Temperature"),
      tools: z.boolean().default(false).describe("Enable tool use"),
      route: z.enum(["local", "cloud", "auto"]).default("auto").describe("Routing override"),
    },
    async ({ prompt, replyTo, maxTokens, temperature, tools, route }) => {
      if (!mqttClient.connected()) {
        return {
          content: [{ type: "text" as const, text: "MQTT broker not connected." }],
          isError: true,
        };
      }

      mqttClient.publish("ctx/local-ai/prompt", {
        prompt,
        replyTo,
        maxTokens,
        temperature,
        tools,
        route,
      });

      return {
        content: [{
          type: "text" as const,
          text: `Prompt sent to local-ai service. Reply will arrive on ${replyTo}`,
        }],
      };
    },
  );

  server.tool(
    "cc_local_ai_models",
    "List available Ollama models with capability tiers, or switch the active model",
    {
      action: z.enum(["list", "switch"]).default("list").describe("list: show models, switch: change active model"),
      model: z.string().optional().describe("Model name to switch to (required for switch action)"),
    },
    async ({ action, model }) => {
      if (action === "switch") {
        if (!model) {
          return {
            content: [{ type: "text" as const, text: "Model name required for switch action." }],
            isError: true,
          };
        }
        setSetting("ollama_model", model);
        return {
          content: [{ type: "text" as const, text: `Active model set to: ${model}` }],
        };
      }

      const running = await isOllamaRunning();
      if (!running) {
        return {
          content: [{ type: "text" as const, text: "Ollama is not running. Cannot list models." }],
          isError: true,
        };
      }

      const models = await listModelsWithCaps();
      const active = getSetting("ollama_model") ?? "(none)";
      const lines = [`Active: ${active}`, "", "Available:"];
      for (const m of models) {
        const marker = m.name === active ? " *" : "";
        const sizeMb = Math.round(m.size / 1e6);
        lines.push(
          `  ${m.name} -- ${m.tier}, ${sizeMb}MB, tools: ${m.supportsTools ? "yes" : "no"}${marker}`,
        );
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
