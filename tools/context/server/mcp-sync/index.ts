import type { CtxMqttClient } from "ctx-mqtt";
import { seedMcpServers } from "./seed.js";
import { checkUpdates } from "./registry.js";
import { generateConfigs } from "./generate.js";

const POLL_INTERVAL = 30_000;
const TOPIC = "ctx/mcp/registry/updated";

export interface McpSync {
  start(): void;
  stop(): void;
  sync(): Promise<{ updates: number; written: string[] }>;
}

export function createMcpSync(
  root: string,
  mqttClient: CtxMqttClient,
): McpSync {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastPoll = new Date().toISOString();

  const seeded = seedMcpServers();
  if (seeded > 0) {
    console.log(`[mcp-sync] seeded ${seeded} default server(s)`);
    generateConfigs(root);
  }

  async function poll(): Promise<number> {
    const result = await checkUpdates(lastPoll);
    lastPoll = new Date().toISOString();
    if (result.error) {
      console.warn(`[mcp-sync] registry poll failed: ${result.error}`);
    }
    return result.servers.length;
  }

  async function sync(): Promise<{ updates: number; written: string[] }> {
    const updates = await poll();
    const { written } = generateConfigs(root);
    mqttClient.publish(TOPIC, {
      updates,
      written,
      timestamp: lastPoll,
    });
    return { updates, written };
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(() => {
      sync().catch((err) => {
        console.warn(`[mcp-sync] poll error: ${err}`);
      });
    }, POLL_INTERVAL);
    console.log(`[mcp-sync] polling every ${POLL_INTERVAL / 1000}s`);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, sync };
}
