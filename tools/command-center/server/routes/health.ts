import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import { listSolutions } from "../solutions/index.js";
import { getSetting } from "../db/index.js";
import { listProjects } from "../db/index.js";

export function registerHealthRoutes(app: FastifyInstance, mqttClient: CtxMqttClient): void {
  app.get("/api/health", async () => {
    const solutions = listSolutions(null);
    const projects = listProjects({ status: "active" });
    const firstRun = solutions.length === 0 && projects.length === 0;

    const hasAnthropic = !!getSetting("anthropic_api_key");
    const hasOpenai = !!getSetting("openai_api_key");
    const aiConfigured = hasAnthropic || hasOpenai;
    const provider = getSetting("ai_provider") ?? (hasAnthropic ? "anthropic" : hasOpenai ? "openai" : null);

    const mqttConnected = mqttClient.connected();

    const services: Array<{ id: string; label: string; status: "ok" | "degraded" | "down"; detail?: string }> = [
      {
        id: "ai",
        label: "AI Provider",
        status: aiConfigured ? "ok" : "down",
        detail: aiConfigured ? `${provider}` : "No API key configured",
      },
      {
        id: "mqtt",
        label: "MQTT Broker",
        status: mqttConnected ? "ok" : "down",
        detail: mqttConnected ? "connected" : "disconnected",
      },
    ];

    return {
      firstRun,
      ai: { configured: aiConfigured, provider },
      mqtt: mqttConnected ? "connected" : "disconnected",
      platform: process.platform as "darwin" | "win32" | "linux",
      services,
    };
  });
}
