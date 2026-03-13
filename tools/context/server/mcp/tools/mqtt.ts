import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { mqttClient } = deps;
  server.tool(
    "cc_mqtt_publish",
    "Publish a JSON message to an MQTT topic on the CC bus",
    {
      topic: z.string().describe("Full topic (e.g. ctx/teams/send)"),
      payload: z.record(z.string(), z.unknown()).describe("JSON payload object"),
      retain: z.boolean().default(false).describe("Retain message on broker"),
    },
    async ({ topic, payload, retain }) => {
      if (!mqttClient.connected()) {
        return {
          content: [{ type: "text" as const, text: "MQTT broker not connected." }],
          isError: true,
        };
      }
      mqttClient.publish(topic, payload, retain);
      return {
        content: [{ type: "text" as const, text: `Published to ${topic}` }],
      };
    },
  );

  server.tool(
    "cc_mqtt_read",
    "Read the current retained value of an MQTT topic",
    {
      topic: z.string().describe("Topic to read (e.g. ctx/status)"),
    },
    async ({ topic }) => {
      if (!mqttClient.connected()) {
        return {
          content: [{ type: "text" as const, text: "MQTT broker not connected." }],
          isError: true,
        };
      }
      const msg = await mqttClient.readRetained(topic, 3000);
      const text = msg !== null
        ? JSON.stringify(msg, null, 2)
        : "(no retained message on this topic)";
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "cc_teams_send",
    "Send a message to a Teams channel via the MQTT bus",
    {
      channel: z.string().describe("Teams channel name"),
      body: z.string().describe("Message body (markdown supported)"),
      threadId: z.string().optional().describe("Reply to an existing thread"),
    },
    async ({ channel, body, threadId }) => {
      if (!mqttClient.connected()) {
        return {
          content: [{ type: "text" as const, text: "MQTT broker not connected." }],
          isError: true,
        };
      }
      const topic = threadId ? "ctx/teams/reply" : "ctx/teams/send";
      mqttClient.publish(topic, { channel, body, threadId });
      return {
        content: [{
          type: "text" as const,
          text: `Sent to Teams #${channel}${threadId ? ` (thread ${threadId})` : ""}`,
        }],
      };
    },
  );

  server.tool(
    "cc_mqtt_status",
    "Check if the MQTT broker connection is healthy",
    {},
    async () => {
      const connected = mqttClient.connected();
      return {
        content: [{
          type: "text" as const,
          text: connected ? "MQTT broker connected." : "MQTT broker disconnected.",
        }],
      };
    },
  );
}
