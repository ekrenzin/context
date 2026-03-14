/**
 * Broadcasts terminal output to remote clients via Supabase Broadcast.
 *
 * Per-session channels (`terminal:{sessionId}`) with 50ms output batching
 * to reduce message rate. Only broadcasts sessions marked with remoteAccess.
 * Provides scrollback replay from JSONL session logs (last ~50KB).
 */

import fs from "fs";
import path from "path";
import { resolveSupabaseConfig, createSupabaseClient } from "../sync/supabase-client.js";
import type { SupabaseClient } from "../sync/supabase-client.js";

interface BroadcastChannel {
  send: (payload: { type: string; event: string; payload: Record<string, unknown> }) => void;
  unsubscribe: () => void;
}

interface SessionRelay {
  channel: BroadcastChannel;
  buffer: string;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

const BATCH_INTERVAL = 50;
const SCROLLBACK_BYTES = 50 * 1024;

let sb: SupabaseClient | null = null;
const relays = new Map<string, SessionRelay>();
let logDir: string | null = null;

export function initBroadcastRelay(root: string): void {
  logDir = path.join(root, "memory", "sessions");
  const config = resolveSupabaseConfig();
  if (!config) return;
  sb = createSupabaseClient(config);
  if (sb) console.log("[broadcast-relay] initialized");
}

export function startSessionBroadcast(sessionId: string): void {
  if (!sb || relays.has(sessionId)) return;

  const channel = (sb as unknown as {
    channel(name: string, opts?: Record<string, unknown>): BroadcastChannel & { subscribe(): void };
  }).channel(`terminal:${sessionId}`, { config: { broadcast: { self: false } } });

  (channel as BroadcastChannel & { subscribe(): void }).subscribe();

  relays.set(sessionId, { channel, buffer: "", flushTimer: null });
}

export function broadcastOutput(sessionId: string, data: string): void {
  const relay = relays.get(sessionId);
  if (!relay) return;

  relay.buffer += data;

  if (!relay.flushTimer) {
    relay.flushTimer = setTimeout(() => {
      flushBuffer(sessionId);
    }, BATCH_INTERVAL);
  }
}

function flushBuffer(sessionId: string): void {
  const relay = relays.get(sessionId);
  if (!relay || !relay.buffer) return;

  relay.channel.send({
    type: "broadcast",
    event: "output",
    payload: { data: relay.buffer },
  });

  relay.buffer = "";
  relay.flushTimer = null;
}

export function broadcastExit(sessionId: string, exitCode: number): void {
  const relay = relays.get(sessionId);
  if (!relay) return;

  // Flush any remaining buffered output first
  flushBuffer(sessionId);

  relay.channel.send({
    type: "broadcast",
    event: "exit",
    payload: { exitCode },
  });

  stopSessionBroadcast(sessionId);
}

export function stopSessionBroadcast(sessionId: string): void {
  const relay = relays.get(sessionId);
  if (!relay) return;

  if (relay.flushTimer) clearTimeout(relay.flushTimer);
  relay.channel.unsubscribe();
  relays.delete(sessionId);
}

/**
 * Returns recent terminal output from the JSONL session log.
 * Reads the last ~50KB of the log file and extracts output entries.
 */
export function getScrollback(sessionId: string): string {
  if (!logDir) return "";
  const logFile = path.join(logDir, `${sessionId}.jsonl`);

  let raw: string;
  try {
    const stat = fs.statSync(logFile);
    if (stat.size <= SCROLLBACK_BYTES) {
      raw = fs.readFileSync(logFile, "utf-8");
    } else {
      const buf = Buffer.alloc(SCROLLBACK_BYTES);
      const fd = fs.openSync(logFile, "r");
      fs.readSync(fd, buf, 0, SCROLLBACK_BYTES, stat.size - SCROLLBACK_BYTES);
      fs.closeSync(fd);
      raw = buf.toString("utf-8");
      // Drop the first (likely partial) line
      const nl = raw.indexOf("\n");
      raw = nl >= 0 ? raw.slice(nl + 1) : raw;
    }
  } catch {
    return "";
  }

  const output: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === "output" && entry.data) {
        output.push(entry.data);
      }
    } catch { /* skip malformed lines */ }
  }

  return output.join("");
}

export function stopAllBroadcasts(): void {
  for (const id of relays.keys()) {
    stopSessionBroadcast(id);
  }
}
