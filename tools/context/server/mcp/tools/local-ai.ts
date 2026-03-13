import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { generate, isOllamaRunning, listModels } from "../../ai/ollama.js";
import { getSetting } from "../../db/index.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { mqttClient } = deps;
  server.tool(
    "cc_local_ai_prompt",
    "Send a prompt to the local Ollama model. Zero cost, zero latency, runs on the user's machine. Use for quick drafts, summaries, naming, brainstorming, or any task where a fast local response beats a round-trip.",
    {
      prompt: z.string().describe("The prompt to send"),
      maxTokens: z.number().int().default(200).describe("Max tokens to generate"),
      temperature: z.number().default(0.7).describe("Sampling temperature (0-1)"),
    },
    async ({ prompt, maxTokens, temperature }) => {
      const model = getSetting("ollama_model");
      if (!model) {
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

      const response = await generate(prompt, model, { temperature, maxTokens });
      return {
        content: [{ type: "text" as const, text: response }],
      };
    },
  );

  server.tool(
    "cc_local_ai_status",
    "Check the local AI service status: model, Ollama health, and MQTT presence",
    {},
    async () => {
      const model = getSetting("ollama_model") ?? "(none)";
      const running = await isOllamaRunning();
      const models = running ? await listModels() : [];
      const mqttOk = mqttClient.connected();

      const lines = [
        `Model: ${model}`,
        `Ollama: ${running ? "running" : "stopped"}`,
        `MQTT: ${mqttOk ? "connected" : "disconnected"}`,
        `Available models: ${models.length > 0 ? models.map((m) => m.name).join(", ") : "(none)"}`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_local_ai_mqtt_prompt",
    "Send a prompt to the local AI via MQTT (fire-and-forget). Reply arrives on the replyTo topic. Use when you want async/decoupled inference.",
    {
      prompt: z.string().describe("The prompt to send"),
      replyTo: z.string().default("ctx/local-ai/reply").describe("MQTT topic for the reply"),
      maxTokens: z.number().int().default(200).describe("Max tokens"),
      temperature: z.number().default(0.7).describe("Temperature"),
    },
    async ({ prompt, replyTo, maxTokens, temperature }) => {
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
      });

      return {
        content: [{
          type: "text" as const,
          text: `Prompt sent to local-ai service. Reply will arrive on ${replyTo}`,
        }],
      };
    },
  );
}
