/**
 * MCP server with auto-discovered tools and MQTT-triggered hot reload.
 *
 * Tool files in mcp/tools/*.ts are scanned automatically. Each must
 * export: register(server: McpServer, deps: McpDeps): void
 *
 * To reload tools at runtime, publish to ctx/mcp/reload on MQTT.
 * Connected MCP clients get disconnected and must reconnect (standard
 * SSE reconnect handles this).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import type { AgentScheduler } from "../agent-scheduler.js";
import type { UpdateChecker } from "../update-checker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.join(__dirname, "tools");
const RELOAD_TOPIC = "ctx/mcp/reload";

export interface McpDeps {
  scheduler: AgentScheduler;
  mqttClient: CtxMqttClient;
  updateChecker: UpdateChecker;
  root: string;
}

type ToolRegister = (server: McpServer, deps: McpDeps) => void;

async function scanTools(): Promise<ToolRegister[]> {
  const entries = fs.readdirSync(TOOLS_DIR).filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.startsWith("_"),
  );

  const registers: ToolRegister[] = [];

  for (const file of entries) {
    const abs = path.join(TOOLS_DIR, file);
    // Cache-bust so re-imports pick up changes at runtime
    const url = pathToFileURL(abs).href + `?v=${Date.now()}`;
    try {
      const mod = await import(url);
      if (typeof mod.register === "function") {
        registers.push(mod.register);
      } else {
        console.warn(`[mcp] ${file} has no register() export -- skipped`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mcp] failed to load ${file}: ${msg}`);
    }
  }

  return registers;
}

function buildServer(registers: ToolRegister[], deps: McpDeps): McpServer {
  const mcp = new McpServer({
    name: "ctx-command-center",
    version: "0.1.0",
  });

  for (const register of registers) {
    try {
      register(mcp, deps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mcp] tool register() failed: ${msg}`);
    }
  }

  return mcp;
}

export async function createMcpServer(deps: McpDeps): Promise<McpServer> {
  const registers = await scanTools();
  console.log(`[mcp] loaded ${registers.length} tool module(s)`);
  return buildServer(registers, deps);
}

export function registerMcpRoutes(
  app: FastifyInstance,
  initialMcp: McpServer,
  deps: McpDeps,
): void {
  let mcp = initialMcp;
  const transports = new Map<string, SSEServerTransport>();

  // ── MQTT-triggered reload ───────────────────────────────────────

  deps.mqttClient.subscribe(RELOAD_TOPIC, async () => {
    console.log("[mcp] reload triggered via MQTT");

    // Close all existing transports (clients will reconnect)
    for (const [id, transport] of transports) {
      try { transport.close?.(); } catch { /* best effort */ }
      transports.delete(id);
    }

    // Rebuild server with fresh tool imports
    try {
      const registers = await scanTools();
      mcp = buildServer(registers, deps);
      console.log(`[mcp] reloaded ${registers.length} tool module(s)`);
      deps.mqttClient.publish("ctx/mcp/status", {
        status: "reloaded",
        tools: registers.length,
        ts: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[mcp] reload failed: ${msg}`);
      deps.mqttClient.publish("ctx/mcp/status", {
        status: "error",
        error: msg,
        ts: new Date().toISOString(),
      });
    }
  });

  // ── SSE transport routes ────────────────────────────────────────

  app.get("/mcp/sse", async (_req, reply) => {
    reply.hijack();
    const transport = new SSEServerTransport("/mcp/messages", reply.raw);
    transports.set(transport.sessionId, transport);
    reply.raw.on("close", () => {
      transports.delete(transport.sessionId);
    });
    await transport.start();
    await mcp.connect(transport);
  });

  app.post("/mcp/messages", async (req, reply) => {
    const sessionId = (req.query as Record<string, string>).sessionId;
    const transport = transports.get(sessionId);
    if (!transport) {
      reply.code(400).send({ error: "Unknown MCP session" });
      return;
    }
    reply.hijack();
    await transport.handlePostMessage(req.raw, reply.raw, req.body);
  });
}
