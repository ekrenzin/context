/**
 * Remote command bridge — listens for pending commands in Supabase and
 * dispatches them locally via the command dispatcher.
 *
 * Uses Supabase Realtime for instant pickup. Falls back to 5-second
 * polling if Realtime disconnects. Honors the `remote_access_enabled`
 * kill switch and skips expired commands.
 */

import { resolveSupabaseConfig, createSupabaseClient } from "./supabase-client.js";
import type { SupabaseClient, RealtimeChannel } from "./supabase-client.js";
import { dispatch, isKnownCommand } from "./command-dispatcher.js";
import { getSetting } from "../db/index.js";

interface CommandRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  expires_at?: string;
}

let sb: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

function isEnabled(): boolean {
  return getSetting("remote_access_enabled") !== "false";
}

function isExpired(row: CommandRow): boolean {
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
}

async function claimAndDispatch(row: CommandRow): Promise<void> {
  if (!sb) return;
  if (!isEnabled()) {
    await sb.from("commands").update({ status: "rejected", error: "remote access disabled" }).eq("id", row.id);
    return;
  }

  if (isExpired(row)) {
    await sb.from("commands").update({ status: "expired", error: "command expired" }).eq("id", row.id);
    return;
  }

  if (!isKnownCommand(row.type)) {
    await sb.from("commands").update({ status: "rejected", error: `unknown command: ${row.type}` }).eq("id", row.id);
    return;
  }

  // Optimistic lock: only proceed if still pending
  const { data } = await sb
    .from("commands")
    .update({ status: "running" })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (!data?.length) return; // Another instance claimed it

  const result = await dispatch(row.type, row.payload ?? {});

  if (result.status === "ok") {
    await sb.from("commands").update({
      status: "completed",
      result: result.result ?? {},
      completed_at: new Date().toISOString(),
    }).eq("id", row.id);
  } else {
    await sb.from("commands").update({
      status: "failed",
      error: result.error,
      completed_at: new Date().toISOString(),
    }).eq("id", row.id);
  }
}

async function pollPending(): Promise<void> {
  if (!sb || !isEnabled()) return;
  try {
    const { data } = await sb
      .from("commands")
      .select("id,type,payload,status,expires_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (!data?.length) return;
    for (const row of data as unknown as CommandRow[]) {
      await claimAndDispatch(row);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[remote-bridge] poll error:", msg);
  }
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(pollPending, 5_000);
  console.log("[remote-bridge] polling fallback active (5s)");
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function startRemoteBridge(): { stop(): void } {
  const config = resolveSupabaseConfig();
  if (!config) {
    console.log("[remote-bridge] no Supabase config -- bridge disabled");
    return { stop() {} };
  }

  sb = createSupabaseClient(config);
  if (!sb) return { stop() {} };

  running = true;

  // Realtime subscription
  try {
    channel = sb
      .channel("remote-commands")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commands" },
        async (payload: unknown) => {
          const row = (payload as { new: CommandRow }).new;
          if (row.status !== "pending") return;
          await claimAndDispatch(row);
        },
      )
      .subscribe();
  } catch {
    console.warn("[remote-bridge] realtime setup failed, using polling");
    startPolling();
  }

  // Start polling as fallback; Realtime handles instant delivery
  startPolling();
  // Immediate poll to catch anything queued while offline
  pollPending();

  console.log("[remote-bridge] started");

  return {
    stop() {
      running = false;
      channel?.unsubscribe();
      channel = null;
      stopPolling();
      sb = null;
      console.log("[remote-bridge] stopped");
    },
  };
}
