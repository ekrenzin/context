/**
 * Tunnel guard — requires a PIN + host authorization for access through
 * Cloudflare Tunnel.
 *
 * Two-factor flow:
 *   1. Remote user enters PIN (client-side)
 *   2. Host authorizes the connection (host-side FAB + modal)
 *
 * When a request arrives through the tunnel (cf-connecting-ip header):
 *   - PIN check: validates `ctx_pin` cookie
 *   - Host auth: validates `ctx_tunnel_session` cookie against approved set
 *   - POST /api/tunnel/pin accepts { pin } and sets the PIN cookie
 *   - POST /api/tunnel/authorize/:id approves a pending connection (host only)
 *   - DELETE /api/tunnel/authorize/:id denies a pending connection (host only)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import crypto from "crypto";
import { getSetting } from "../db/index.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PIN_PATH = "/api/tunnel/pin";
const PROBE_PATH = "/api/tunnel/probe";
const AUTH_PREFIX = "/api/tunnel/authorize";
const PENDING_PATH = "/api/tunnel/connections";

const TOPIC_CREATED = "ctx/tunnel/connection/created";
const TOPIC_RESOLVED = "ctx/tunnel/connection/resolved";

export interface PendingConnection {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

// In-memory stores — cleared on restart (tunneled users must re-auth)
const pending = new Map<string, PendingConnection>();
const approved = new Set<string>();
const waiters = new Map<string, { resolve: (approved: boolean) => void; timer: ReturnType<typeof setTimeout> }>();

const CONNECTION_TTL_MS = 5 * 60 * 1000; // 5 min timeout for pending

function isTunnelRequest(req: FastifyRequest): boolean {
  return !!req.headers["cf-connecting-ip"];
}

function extractCookie(req: FastifyRequest, name: string): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const re = new RegExp(`${name}=([^;]+)`);
  const match = cookie.match(re);
  return match ? match[1] : null;
}

function createPendingConnection(req: FastifyRequest): PendingConnection {
  return {
    id: crypto.randomUUID(),
    ip: (req.headers["cf-connecting-ip"] as string) ?? "unknown",
    userAgent: (req.headers["user-agent"] as string)?.slice(0, 120) ?? "unknown",
    createdAt: new Date().toISOString(),
  };
}

export function registerTunnelAuth(app: FastifyInstance, mqtt?: CtxMqttClient): void {
  // PIN verification endpoint
  app.post<{ Body: { pin: string } }>(PIN_PATH, async (req, reply) => {
    const { pin } = req.body ?? {};
    const expected = getSetting("tunnel_pin");

    if (!expected || pin === expected) {
      reply
        .header("Set-Cookie", `ctx_pin=${pin}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`)
        .send({ ok: true });
    } else {
      reply.code(401).send({ ok: false, error: "wrong pin" });
    }
  });

  // Lightweight probe — returns 200 locally, gets blocked by the guard
  // with 403 when accessed through the tunnel without a valid PIN.
  app.post(PROBE_PATH, async () => ({ ok: true }));

  // List pending connections (host only — non-tunnel requests)
  app.get(PENDING_PATH, async (req) => {
    if (isTunnelRequest(req)) return { connections: [] };
    return { connections: Array.from(pending.values()) };
  });

  // Approve a pending connection (host only)
  app.post<{ Params: { id: string } }>(`${AUTH_PREFIX}/:id`, async (req, reply) => {
    if (isTunnelRequest(req)) {
      reply.code(403).send({ error: "host-only endpoint" });
      return;
    }
    const { id } = req.params;
    const conn = pending.get(id);
    if (!conn) {
      reply.code(404).send({ error: "connection not found or expired" });
      return;
    }
    pending.delete(id);
    approved.add(id);
    const waiter = waiters.get(id);
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(true);
      waiters.delete(id);
    }
    mqtt?.publish(TOPIC_RESOLVED, { id, status: "approved" });
    return { ok: true, id };
  });

  // Deny a pending connection (host only)
  app.delete<{ Params: { id: string } }>(`${AUTH_PREFIX}/:id`, async (req, reply) => {
    if (isTunnelRequest(req)) {
      reply.code(403).send({ error: "host-only endpoint" });
      return;
    }
    const { id } = req.params;
    pending.delete(id);
    approved.delete(id);
    const waiter = waiters.get(id);
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(false);
      waiters.delete(id);
    }
    mqtt?.publish(TOPIC_RESOLVED, { id, status: "denied" });
    return { ok: true, id };
  });

  // Guard hook
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isTunnelRequest(req)) return;

    // Always allow auth-related endpoints
    const url = req.url.split("?")[0];
    if (url === PIN_PATH || url === PROBE_PATH || url.startsWith(AUTH_PREFIX)) return;

    const expected = getSetting("tunnel_pin");
    const pinOk = !expected || extractCookie(req, "ctx_pin") === expected;

    // PIN must pass first
    if (!pinOk) {
      if (MUTATING_METHODS.has(req.method)) {
        reply.code(403).send({ error: "tunnel mutations require PIN authentication" });
        return;
      }
      // Read-only: let through so React app loads and shows PIN modal
      return;
    }

    // Check host authorization
    const hostAuthRequired = getSetting("tunnel_host_auth") === "true";
    if (!hostAuthRequired) return;

    const sessionId = extractCookie(req, "ctx_tunnel_session");
    if (sessionId && approved.has(sessionId)) return;

    // Read-only requests for static assets / app shell: let through
    if (!MUTATING_METHODS.has(req.method)) {
      // But inject a header so the frontend knows auth is needed
      if (!sessionId) {
        reply.header("X-Tunnel-Auth-Required", "true");
      }
      return;
    }

    // Mutation without host approval — block
    reply.code(403).send({ error: "tunnel connection not authorized by host" });
  });

  // Request host authorization (called by remote user after PIN)
  app.post<{ Body: { pin?: string } }>("/api/tunnel/request-auth", async (req, reply) => {
    if (!isTunnelRequest(req)) {
      return { ok: true, status: "local" };
    }

    // Must have valid PIN first
    const expected = getSetting("tunnel_pin");
    const pinOk = !expected || extractCookie(req, "ctx_pin") === expected;
    if (!pinOk) {
      reply.code(403).send({ error: "PIN required first" });
      return;
    }

    // Check if already authorized
    const existing = extractCookie(req, "ctx_tunnel_session");
    if (existing && approved.has(existing)) {
      return { ok: true, status: "approved", sessionId: existing };
    }

    // Create pending connection and notify host
    const conn = createPendingConnection(req);
    pending.set(conn.id, conn);
    mqtt?.publish(TOPIC_CREATED, conn);

    // Wait for host decision (up to CONNECTION_TTL_MS)
    const result = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(conn.id);
        waiters.delete(conn.id);
        resolve(false);
      }, CONNECTION_TTL_MS);
      waiters.set(conn.id, { resolve, timer });
    });

    if (result) {
      reply
        .header(
          "Set-Cookie",
          `ctx_tunnel_session=${conn.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`,
        )
        .send({ ok: true, status: "approved", sessionId: conn.id });
    } else {
      reply.code(403).send({ ok: false, status: "denied" });
    }
  });
}
