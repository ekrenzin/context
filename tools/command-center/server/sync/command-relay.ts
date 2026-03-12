import { resolveSupabaseConfig, createSupabaseClient } from "./supabase-client.js";
import type { SupabaseClient, RealtimeChannel } from "./supabase-client.js";
import type { CtxMqttClient } from "ctx-mqtt";

interface Command {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
}

let channel: RealtimeChannel | null = null;

export function startCommandRelay(mqtt: CtxMqttClient): { stop(): void } {
  const config = resolveSupabaseConfig();
  if (!config) return { stop() {} };

  const sb = createSupabaseClient(config);
  if (!sb) return { stop() {} };

  channel = sb
    .channel("commands")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "commands" }, async (payload: unknown) => {
      const record = (payload as { new: Command }).new;
      if (record.status !== "pending") return;

      await sb.from("commands").update({ status: "running" }).eq("id", record.id);

      const topic = `ctx/tasks/${record.type}`;
      mqtt.publish(topic, record.payload);

      await sb.from("commands").update({
        status: "completed",
        result: { executed: true, topic },
        completed_at: new Date().toISOString(),
      }).eq("id", record.id);
    })
    .subscribe();

  return {
    stop() {
      channel?.unsubscribe();
      channel = null;
    },
  };
}
