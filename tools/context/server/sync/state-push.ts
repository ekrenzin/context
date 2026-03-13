import { listSessions, getLatestAnalytics, listMemory } from "../db/index.js";
import { resolveSupabaseConfig, createSupabaseClient } from "./supabase-client.js";
import type { SupabaseClient } from "./supabase-client.js";
import { setSetting, getSetting } from "../db/index.js";

const DEBOUNCE_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  const config = resolveSupabaseConfig();
  if (!config) return null;
  client = createSupabaseClient(config);
  return client;
}

async function pushState(): Promise<void> {
  const sb = getClient();
  if (!sb) return;

  const sessions = listSessions({ limit: 50 });
  const sessionRows = sessions.map((s) => ({
    id: s.chat_id,
    started_at: s.timestamp,
    tools_used: s.tools,
    outcome: s.verdict,
    title: s.title,
    summary: s.summary,
  }));

  if (sessionRows.length) {
    await sb.from("sessions").upsert(sessionRows);
  }

  const analytics = getLatestAnalytics();
  if (analytics) {
    await sb.from("analytics").upsert([{
      id: analytics.date,
      metric: "daily",
      value: JSON.stringify({
        productiveRate: analytics.productive_rate,
        avgEfficiency: analytics.avg_efficiency,
        totalSessions: analytics.total_sessions,
      }),
      period: analytics.date,
    }]);
  }

  const memory = listMemory({ limit: 100 });
  const memoryRows = memory.map((m) => ({
    id: m.id,
    category: m.type,
    title: m.title,
    content: m.content.slice(0, 1000),
    created_at: m.created_at,
  }));

  if (memoryRows.length) {
    await sb.from("memory_summary").upsert(memoryRows);
  }

  setSetting("last_sync_at", new Date().toISOString());
}

export function schedulePush(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await pushState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sync] push failed: ${msg}`);
    }
  }, DEBOUNCE_MS);
}

export async function pushNow(): Promise<void> {
  if (timer) clearTimeout(timer);
  await pushState();
}

export function syncStatus(): { lastSyncAt: string | null; configured: boolean } {
  return {
    lastSyncAt: getSetting("last_sync_at") ?? null,
    configured: resolveSupabaseConfig() !== null,
  };
}
