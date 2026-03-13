import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import { listSolutions } from "../solutions/index.js";
import { getSetting } from "../db/index.js";
import { listProjects } from "../db/index.js";
import { isOllamaInstalled, isOllamaRunning, ensureServing } from "../ai/ollama.js";

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

    const ollamaInstalled = isOllamaInstalled();
    let ollamaRunning = false;
    if (ollamaInstalled) {
      ollamaRunning = await isOllamaRunning();
      if (!ollamaRunning) {
        try {
          await ensureServing();
          ollamaRunning = true;
        } catch {
          ollamaRunning = false;
        }
      }
    }

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
      {
        id: "ollama",
        label: "Local Model (Ollama)",
        status: !ollamaInstalled ? "degraded" : ollamaRunning ? "ok" : "down",
        detail: !ollamaInstalled ? "Not installed" : ollamaRunning ? "Running" : "Failed to start",
      },
    ];

    const uptimeSec = process.uptime();
    const startedAt = new Date(Date.now() - uptimeSec * 1000).toISOString();

    return {
      firstRun,
      ai: { configured: aiConfigured, provider },
      mqtt: mqttConnected ? "connected" : "disconnected",
      platform: process.platform as "darwin" | "win32" | "linux",
      services,
      process: {
        pid: process.pid,
        ppid: process.ppid,
        startedAt,
        uptimeSec: Math.floor(uptimeSec),
        argv: process.argv,
        cwd: process.cwd(),
        tty: process.stdout.isTTY ? (process.env.TERM_PROGRAM ?? process.env.TERM ?? "tty") : null,
        nodeVersion: process.version,
      },
    };
  });
}
