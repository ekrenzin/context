/**
 * Cloudflare Tunnel manager — spawns cloudflared as a child process
 * for remote UI access.
 *
 * - Quick tunnel (no name): works out of the box, random URL
 * - Named tunnel: requires `cloudflared tunnel login` first, then
 *   `cloudflared tunnel create <name>` — stable URL
 *
 * If a named tunnel fails due to missing auth, falls back to quick tunnel.
 */

import { spawn, execFileSync, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { FastifyInstance } from "fastify";
import { getSetting, setSetting } from "../db/index.js";
import { cloudflaredCliStatus, installCloudflared } from "../ai/cli-tools.js";

let proc: ChildProcess | null = null;
let tunnelUrl: string | null = null;
let status: "stopped" | "starting" | "running" | "error" = "stopped";
let lastError: string | null = null;
let restartAttempts = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let usingQuickFallback = false;

const MAX_RESTART_ATTEMPTS = 3;
const BASE_RESTART_DELAY_MS = 2000;

function isEnabled(): boolean {
  return getSetting("tunnel_enabled") === "true";
}

function hasOriginCert(): boolean {
  const dirs = [
    join(homedir(), ".cloudflared"),
    join(homedir(), ".cloudflare-warp"),
    "/etc/cloudflared",
    "/usr/local/etc/cloudflared",
  ];
  return dirs.some((d) => existsSync(join(d, "cert.pem")));
}

function resolveTargetPort(): string {
  // Prefer Vite dev server (19471) for HMR support; fall back to Fastify (19470)
  const vitePort = process.env.CTX_VITE_PORT ?? "19471";
  const serverPort = process.env.CTX_DASHBOARD_PORT ?? "19470";
  return process.env.CTX_TUNNEL_PORT ?? vitePort ?? serverPort;
}

function startQuick(): void {
  const target = `http://127.0.0.1:${resolveTargetPort()}`;
  spawnCloudflared(["tunnel", "--url", target]);
}

function startNamed(name: string): void {
  if (!hasOriginCert()) {
    console.warn("[tunnel] no origin cert found — falling back to quick tunnel");
    console.warn("[tunnel] run 'cloudflared tunnel login' to use named tunnels");
    usingQuickFallback = true;
    startQuick();
    return;
  }
  spawnCloudflared(["tunnel", "run", name]);
}

function spawnCloudflared(args: string[]): void {
  status = "starting";
  lastError = null;

  try {
    proc = spawn("cloudflared", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
  } catch (err) {
    status = "error";
    lastError = err instanceof Error ? err.message : String(err);
    console.error("[tunnel] failed to spawn cloudflared:", lastError);
    return;
  }

  let stderrBuf = "";

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrBuf += text;
    const line = text.trim();
    if (line) console.log(`[tunnel] ${line}`);

    // Quick tunnel URL
    const urlMatch = line.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
    if (urlMatch) {
      tunnelUrl = urlMatch[0];
      setSetting("tunnel_url", tunnelUrl);
      status = "running";
      restartAttempts = 0;
      console.log(`[tunnel] active: ${tunnelUrl}`);
    }

    // Named tunnel connection
    if (line.includes("Registered tunnel connection")) {
      status = "running";
      restartAttempts = 0;
      const savedUrl = getSetting("tunnel_url");
      if (savedUrl) tunnelUrl = savedUrl;
      console.log("[tunnel] named tunnel connected");
    }
  });

  proc.on("exit", (code) => {
    const hadCertError = stderrBuf.includes("origin cert") || stderrBuf.includes("origincert");
    tunnelUrl = null;
    proc = null;

    if (code !== 0 && code !== null) {
      // If named tunnel failed due to cert, fall back to quick
      if (hadCertError && !usingQuickFallback) {
        console.warn("[tunnel] named tunnel auth failed — falling back to quick tunnel");
        usingQuickFallback = true;
        startQuick();
        return;
      }

      lastError = `cloudflared exited with code ${code}`;
      console.warn(`[tunnel] ${lastError}`);
      scheduleRestart();
    } else {
      status = "stopped";
    }
  });

  proc.on("error", (err) => {
    status = "error";
    lastError = err.message;
    proc = null;
    console.error("[tunnel] process error:", err.message);
  });
}

function start(): void {
  if (proc || !isEnabled()) return;
  usingQuickFallback = false;

  const name = getSetting("tunnel_name");
  if (name) {
    startNamed(name);
  } else {
    startQuick();
  }
}

function scheduleRestart(): void {
  if (!isEnabled()) {
    status = "error";
    return;
  }
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    status = "error";
    lastError = `gave up after ${MAX_RESTART_ATTEMPTS} restart attempts`;
    console.error(`[tunnel] ${lastError}`);
    return;
  }
  restartAttempts++;
  const delay = BASE_RESTART_DELAY_MS * Math.pow(2, restartAttempts - 1);
  status = "starting";
  console.log(`[tunnel] restarting in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (usingQuickFallback) startQuick();
    else start();
  }, delay);
}

function stop(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  restartAttempts = 0;
  usingQuickFallback = false;
  if (!proc) {
    status = "stopped";
    return;
  }
  proc.kill("SIGTERM");
  proc = null;
  tunnelUrl = null;
  status = "stopped";
  console.log("[tunnel] stopped");
}

export function startTunnelManager(): { stop(): void } {
  if (isEnabled()) {
    start();
  }
  return { stop };
}

export function getTunnelStatus(): {
  status: string;
  url: string | null;
  error: string | null;
  authenticated: boolean;
  quickFallback: boolean;
} {
  return {
    status,
    url: tunnelUrl,
    error: lastError,
    authenticated: hasOriginCert(),
    quickFallback: usingQuickFallback,
  };
}

export function registerTunnelRoutes(app: FastifyInstance): void {
  app.get("/api/tunnel/status", async () => getTunnelStatus());

  app.post<{ Body: { enabled: boolean } }>("/api/tunnel/toggle", async (req) => {
    const { enabled } = req.body ?? {};
    setSetting("tunnel_enabled", String(!!enabled));
    if (enabled) {
      if (!cloudflaredCliStatus().installed) {
        console.log("[tunnel] cloudflared not found, installing...");
        const result = await installCloudflared();
        if (!result.success) {
          return {
            ...getTunnelStatus(),
            status: "error" as const,
            error: `cloudflared install failed: ${result.error}`,
          };
        }
        console.log("[tunnel] cloudflared installed successfully");
      }
      start();
    } else {
      stop();
    }
    return getTunnelStatus();
  });

  // One-time login for named tunnels
  app.post("/api/tunnel/login", async () => {
    try {
      execFileSync("cloudflared", ["tunnel", "login"], {
        stdio: "inherit",
        timeout: 120_000,
      });
      return { ok: true, authenticated: hasOriginCert() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  });
}
