/**
 * Validates and dispatches remote commands to local subsystems.
 *
 * Pure module with no Supabase dependency — the remote bridge calls this
 * after picking up a command row.
 */

import { z } from "zod";
import {
  spawnSession,
  connectSession,
  killSession,
  listSessions,
} from "../terminal/manager.js";
import { logSessionStarted, tapSession } from "../terminal/session-logger.js";
import { registerTap } from "../terminal/manager.js";

// ── Command schemas ──────────────────────────────────────────────────

const terminalCreate = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  cols: z.number().int().optional(),
  rows: z.number().int().optional(),
  remoteAccess: z.boolean().optional(),
});

const terminalInput = z.object({
  sessionId: z.string().uuid(),
  data: z.string(),
});

const terminalResize = z.object({
  sessionId: z.string().uuid(),
  cols: z.number().int().min(1),
  rows: z.number().int().min(1),
});

const terminalKill = z.object({ sessionId: z.string().uuid() });
const terminalList = z.object({}).optional();

const COMMAND_SCHEMAS: Record<string, z.ZodType> = {
  "terminal:create": terminalCreate,
  "terminal:input": terminalInput,
  "terminal:resize": terminalResize,
  "terminal:kill": terminalKill,
  "terminal:list": terminalList ?? z.object({}).optional(),
  "profiler-scan": z.object({}).optional(),
  "workspace-sync": z.object({}).optional(),
};

// ── Rate limiter ─────────────────────────────────────────────────────

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = { minute: { count: 0, resetAt: 0 } as RateWindow, hour: { count: 0, resetAt: 0 } as RateWindow };
const LIMITS = { minute: 10, hour: 200 };
const EXEMPT_TYPES = new Set(["terminal:input"]);

function checkRate(type: string): boolean {
  if (EXEMPT_TYPES.has(type)) return true;
  const now = Date.now();

  if (now > windows.minute.resetAt) {
    windows.minute = { count: 0, resetAt: now + 60_000 };
  }
  if (now > windows.hour.resetAt) {
    windows.hour = { count: 0, resetAt: now + 3_600_000 };
  }

  if (windows.minute.count >= LIMITS.minute) return false;
  if (windows.hour.count >= LIMITS.hour) return false;

  windows.minute.count++;
  windows.hour.count++;
  return true;
}

// ── Dispatch result ──────────────────────────────────────────────────

export interface DispatchResult {
  status: "ok" | "error";
  result?: unknown;
  error?: string;
}

// ── Input PTY cache for terminal:input ───────────────────────────────

const inputPtys = new Map<string, { write(data: string): void; disconnect(): void }>();

// ── Dispatcher ───────────────────────────────────────────────────────

export function isKnownCommand(type: string): boolean {
  return type in COMMAND_SCHEMAS;
}

export async function dispatch(
  type: string,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const schema = COMMAND_SCHEMAS[type];
  if (!schema) {
    return { status: "error", error: `unknown command type: ${type}` };
  }

  if (!checkRate(type)) {
    return { status: "error", error: "rate limit exceeded" };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", error: `validation: ${parsed.error.message}` };
  }

  try {
    const result = await execute(type, (parsed.data ?? {}) as Record<string, unknown>);
    return { status: "ok", result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", error: msg };
  }
}

async function execute(type: string, data: Record<string, unknown>): Promise<unknown> {
  switch (type) {
    case "terminal:create": {
      const session = await spawnSession(data);
      const tap = await connectSession(session.id);
      if (tap) {
        registerTap(session.id, tap);
        tapSession(session.id, tap);
        logSessionStarted(session);
      }
      return session;
    }

    case "terminal:input": {
      const { sessionId, data: input } = data as { sessionId: string; data: string };
      if (!inputPtys.has(sessionId)) {
        const pty = await connectSession(sessionId);
        if (!pty) throw new Error(`session not found: ${sessionId}`);
        inputPtys.set(sessionId, pty);
        pty.onExit(() => {
          inputPtys.get(sessionId)?.disconnect();
          inputPtys.delete(sessionId);
        });
      }
      inputPtys.get(sessionId)!.write(input);
      return { sent: true };
    }

    case "terminal:resize": {
      const { sessionId, cols, rows } = data as { sessionId: string; cols: number; rows: number };
      const pty = await connectSession(sessionId);
      if (!pty) throw new Error(`session not found: ${sessionId}`);
      pty.resize(cols, rows);
      pty.disconnect();
      return { resized: true };
    }

    case "terminal:kill": {
      const { sessionId } = data as { sessionId: string };
      inputPtys.get(sessionId)?.disconnect();
      inputPtys.delete(sessionId);
      const ok = killSession(sessionId);
      if (!ok) throw new Error(`session not found: ${sessionId}`);
      return { killed: true };
    }

    case "terminal:list":
      return listSessions();

    case "profiler-scan":
    case "workspace-sync":
      // These dispatch via the local API — fire-and-forget
      try {
        const port = process.env.CTX_DASHBOARD_PORT ?? "19470";
        await fetch(`http://127.0.0.1:${port}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
      } catch { /* best-effort */ }
      return { dispatched: true };

    default:
      throw new Error(`unhandled command type: ${type}`);
  }
}
