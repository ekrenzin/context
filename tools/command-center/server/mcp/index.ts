import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import type { AgentScheduler } from "../agent-scheduler.js";
import type { UpdateChecker } from "../update-checker.js";
import { registerSchedulerTools } from "./tools/scheduler.js";
import { registerMqttTools } from "./tools/mqtt.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerOpsTools } from "./tools/ops.js";

export interface McpDeps {
  scheduler: AgentScheduler;
  mqttClient: CtxMqttClient;
  updateChecker: UpdateChecker;
  root: string;
}

export function createMcpServer(deps: McpDeps): McpServer {
  const mcp = new McpServer({
    name: "ctx-command-center",
    version: "0.1.0",
  });

  registerSchedulerTools(mcp, deps.scheduler);
  registerMqttTools(mcp, deps.mqttClient);
  registerSessionTools(mcp, deps.root);
  registerOpsTools(mcp, deps.updateChecker, deps.scheduler, deps.root);

  return mcp;
}

export function registerMcpRoutes(
  app: FastifyInstance,
  mcp: McpServer,
): void {
  const transports = new Map<string, SSEServerTransport>();

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
