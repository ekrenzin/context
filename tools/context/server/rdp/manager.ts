import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  parseRdpConfig,
  spawnBridge,
  BridgeSocket,
  type ProgressCallback,
} from "context-rdp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CTX_ROOT ?? path.resolve(__dirname, "..", "..", "..", "..");

// Use /tmp (not $TMPDIR) because macOS $TMPDIR paths are ~48 chars and
// Unix sockets have a 104-byte path limit. /tmp/ctx-rdp/b-<8chars>.sock = ~27 chars.
const MANIFEST_DIR = "/tmp/ctx-rdp";
const MANIFEST_PATH = path.join(MANIFEST_DIR, "sessions.json");
const SOCKET_DIR = "/tmp/ctx-rdp";

export interface RdpSessionInfo {
  id: string;
  hostname: string;
  port: number;
  username: string;
  domain: string;
  width: number;
  height: number;
  createdAt: string;
  bridgeAlive: boolean;
}

interface PersistedSession {
  id: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  domain: string;
  width: number;
  height: number;
  bridgePid: number;
  socketPath: string;
  createdAt: string;
}

const sessions = new Map<string, PersistedSession>();

// -- Manifest persistence ---------------------------------------------------

function saveManifest(): void {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const entries = [...sessions.values()];
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ sessions: entries }, null, 2));
}

function loadManifest(): PersistedSession[] {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    return JSON.parse(raw).sessions ?? [];
  } catch {
    return [];
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function socketPathFor(id: string): string {
  // Use short prefix to stay under macOS 104-byte Unix socket path limit
  return path.join(SOCKET_DIR, `b-${id.slice(0, 8)}.sock`);
}

// -- Public API -------------------------------------------------------------

export interface CreateSessionOpts {
  config: string;
  password?: string;
  width?: number;
  height?: number;
}

export async function createSession(
  opts: CreateSessionOpts,
  progress: ProgressCallback,
): Promise<RdpSessionInfo> {
  const parsed = parseRdpConfig(opts.config);
  if (!parsed.hostname) throw new Error("Could not parse hostname from RDP config");

  const id = randomUUID();
  const socketPath = socketPathFor(id);

  const bridge = await spawnBridge(
    {
      root: ROOT,
      host: parsed.hostname,
      port: parsed.port,
      username: parsed.username,
      password: opts.password ?? "",
      domain: parsed.domain,
      width: opts.width ?? parsed.width,
      height: opts.height ?? parsed.height,
      socketPath,
    },
    progress,
  );

  const session: PersistedSession = {
    id,
    hostname: parsed.hostname,
    port: parsed.port,
    username: parsed.username,
    domain: parsed.domain,
    width: opts.width ?? parsed.width,
    height: opts.height ?? parsed.height,
    password: opts.password ?? "",
    bridgePid: bridge.pid,
    socketPath,
    createdAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  saveManifest();

  return toInfo(session);
}

/** Connect to a session's bridge socket. Returns undefined if session is dead. */
export async function connectSession(id: string): Promise<BridgeSocket | undefined> {
  const session = sessions.get(id);
  if (!session) return undefined;

  if (!isProcessAlive(session.bridgePid)) {
    sessions.delete(id);
    saveManifest();
    return undefined;
  }

  const sock = new BridgeSocket(session.socketPath);
  try {
    await sock.connect();
  } catch {
    sessions.delete(id);
    saveManifest();
    return undefined;
  }

  return sock;
}

export function getSession(id: string): RdpSessionInfo | undefined {
  const s = sessions.get(id);
  return s ? toInfo(s) : undefined;
}

export function listSessions(): RdpSessionInfo[] {
  return [...sessions.values()].map(toInfo);
}

export function killSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  try { process.kill(session.bridgePid, "SIGTERM"); } catch {}
  try { fs.unlinkSync(session.socketPath); } catch {}
  sessions.delete(id);
  saveManifest();
  return true;
}

/** Reconnect to sessions from a previous server run, respawning dead bridges. */
export async function restoreSessions(): Promise<number> {
  const persisted = loadManifest();
  let restored = 0;

  for (const entry of persisted) {
    if (isProcessAlive(entry.bridgePid)) {
      // Bridge alive -- verify socket is reachable
      const probe = new BridgeSocket(entry.socketPath);
      try {
        await probe.connect();
        probe.disconnect();
        sessions.set(entry.id, entry);
        restored++;
        continue;
      } catch {
        try { process.kill(entry.bridgePid, "SIGTERM"); } catch {}
        try { fs.unlinkSync(entry.socketPath); } catch {}
      }
    } else {
      try { fs.unlinkSync(entry.socketPath); } catch {}
    }

    // Bridge dead -- respawn if we have credentials
    if (!entry.password) continue;

    try {
      const bridge = await spawnBridge(
        {
          root: ROOT,
          host: entry.hostname,
          port: entry.port,
          username: entry.username,
          password: entry.password,
          domain: entry.domain,
          width: entry.width,
          height: entry.height,
          socketPath: entry.socketPath,
        },
        (phase, msg) => console.log(`[rdp] restore ${entry.id.slice(0, 8)}: ${phase} - ${msg}`),
      );

      sessions.set(entry.id, {
        ...entry,
        bridgePid: bridge.pid,
      });
      restored++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rdp] failed to respawn session ${entry.id.slice(0, 8)}: ${msg}`);
    }
  }

  saveManifest();
  return restored;
}

export function closeAll(): void {
  for (const session of sessions.values()) {
    try { process.kill(session.bridgePid, "SIGTERM"); } catch {}
    try { fs.unlinkSync(session.socketPath); } catch {}
  }
  sessions.clear();
}

function toInfo(s: PersistedSession): RdpSessionInfo {
  return {
    id: s.id,
    hostname: s.hostname,
    port: s.port,
    username: s.username,
    domain: s.domain,
    width: s.width,
    height: s.height,
    createdAt: s.createdAt,
    bridgeAlive: isProcessAlive(s.bridgePid),
  };
}
