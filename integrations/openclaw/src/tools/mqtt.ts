import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

let client: MqttClient | null = null;
let connected = false;

function getClient(): MqttClient {
  if (client) return client;

  const url = process.env.CTX_MQTT_URL ?? "mqtt://127.0.0.1:1883";
  client = mqtt.connect(url, {
    clientId: `openclaw-ctx-${process.pid}-${Date.now().toString(36)}`,
    clean: true,
    reconnectPeriod: 5_000,
    connectTimeout: 10_000,
    username: process.env.CTX_MQTT_USER,
    password: process.env.CTX_MQTT_PASS,
  });

  client.on("connect", () => { connected = true; });
  client.on("offline", () => { connected = false; });
  client.on("error", () => { /* reconnect handles it */ });

  return client;
}

function readRetained(topic: string, timeoutMs = 3000): Promise<string | null> {
  return new Promise((resolve) => {
    const c = getClient();
    if (!connected) { resolve(null); return; }

    const timer = setTimeout(() => {
      c.unsubscribe(topic);
      resolve(null);
    }, timeoutMs);

    const handler = (t: string, p: Buffer) => {
      if (t !== topic) return;
      clearTimeout(timer);
      c.removeListener("message", handler);
      c.unsubscribe(topic);
      resolve(p.toString());
    };

    c.on("message", handler);
    c.subscribe(topic, { qos: 1 });
  });
}

export function registerMqttTools(server: McpServer): void {
  server.tool(
    "ctx_mqtt_publish",
    "Publish a message to the Context MQTT bus. Use for triggering workspace events, spawning sessions, or coordinating with other agents.",
    {
      topic: z.string().describe("MQTT topic (e.g. ctx/session/spawn, ctx/local-ai/prompt)"),
      payload: z.string().describe("JSON string payload"),
      retain: z.boolean().default(false).describe("Retain message on broker"),
    },
    async ({ topic, payload, retain }) => {
      const c = getClient();
      if (!connected) {
        return { content: [{ type: "text" as const, text: "MQTT not connected. Is the Context workspace running?" }] };
      }
      c.publish(topic, payload, { qos: retain ? 1 : 0, retain });
      return { content: [{ type: "text" as const, text: `Published to ${topic}` }] };
    },
  );

  server.tool(
    "ctx_mqtt_read",
    "Read a retained message from the Context MQTT bus. Use for checking workspace status, service health, or latest state.",
    {
      topic: z.string().describe("MQTT topic to read (e.g. ctx/status, ctx/local-ai/status)"),
      timeout_ms: z.number().int().default(3000).describe("Timeout in milliseconds"),
    },
    async ({ topic, timeout_ms }) => {
      try {
        const msg = await readRetained(topic, timeout_ms);
        if (msg === null) {
          return { content: [{ type: "text" as const, text: `No retained message on ${topic}` }] };
        }
        return { content: [{ type: "text" as const, text: msg }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `MQTT read failed: ${msg}` }] };
      }
    },
  );

  server.tool(
    "ctx_mqtt_status",
    "Check if the Context MQTT broker is reachable and get workspace online status.",
    {},
    async () => {
      getClient();
      // Give a moment for connection if just started
      if (!connected) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!connected) {
        return { content: [{ type: "text" as const, text: "MQTT broker not reachable. Start the Context workspace first." }] };
      }

      const status = await readRetained("ctx/status", 2000);
      return {
        content: [{
          type: "text" as const,
          text: `MQTT connected.\nWorkspace status: ${status ?? "unknown (no retained status)"}`,
        }],
      };
    },
  );
}
