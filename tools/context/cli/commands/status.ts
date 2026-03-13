import { apiGet } from "../client.js";

interface StatusResponse {
  uptime: number;
  version: string;
  dbSize: number;
  mqttConnected: boolean;
  syncConfigured: boolean;
}

export async function status(): Promise<void> {
  try {
    const data = await apiGet<StatusResponse>("/api/status");
    console.log(`Context Desktop v${data.version}`);
    console.log(`  Uptime: ${Math.round(data.uptime / 1000)}s`);
    console.log(`  DB size: ${(data.dbSize / 1024).toFixed(1)}KB`);
    console.log(`  MQTT: ${data.mqttConnected ? "connected" : "disconnected"}`);
    console.log(`  Sync: ${data.syncConfigured ? "configured" : "not configured"}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed: ${msg}`);
    process.exit(1);
  }
}
