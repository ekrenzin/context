import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { mqttClient } = deps;

  server.tool(
    "cc_agent_emit",
    "Emit an agent event to the MQTT bus. Use this to report tool usage, file changes, test results, commits, errors, and session lifecycle events.",
    {
      tool: z.string().regex(/^[a-z0-9-]+$/).describe(
        "Agent tool identifier (e.g. claude-code, cursor, windsurf, codex)",
      ),
      event: z.string().regex(/^[a-z0-9-/]+$/).describe(
        "Event type (e.g. tool/used, file/edited, session/started, commit/created)",
      ),
      data: z.record(z.string(), z.unknown()).optional().describe(
        "Event payload data",
      ),
    },
    async ({ tool, event, data }) => {
      if (!mqttClient.connected()) {
        return {
          content: [{ type: "text" as const, text: "MQTT broker not connected." }],
          isError: true,
        };
      }

      const topic = `ctx/agent/${tool}/${event}`;
      const payload = {
        tool,
        ts: new Date().toISOString(),
        ...data,
      };

      mqttClient.publish(topic, payload);

      return {
        content: [{
          type: "text" as const,
          text: `Agent event published to ${topic}`,
        }],
      };
    },
  );
}
