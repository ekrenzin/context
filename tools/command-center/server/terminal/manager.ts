import { randomUUID } from "crypto";
import { fork } from "child_process";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PTY_HOST = path.join(__dirname, "pty-host.cjs");
const MANIFEST_DIR = path.join(os.tmpdir(), "ctx-terminals");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "sessions.json");
const SOCKET_DIR = path.join(os.tmpdir(), "ctx-terminals");

export interface SessionInfo {
  id: string;
  command: string;
  cwd: string;
  startedAt: string;
  exitCode?: number;
  label?: string;
}

interface PersistedSession {
  id: string;
  pid: number;
  socketPath: string;
  command: string;
  cwd: string;
  startedAt: string;
  label?: string;
}

export interface SpawnOptions {
  command?: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

/** Disposable handle returned by onData/onExit. */
interface Disposable {
  dispose(): void;
}

/** Proxy that talks to a pty-host over a Unix socket. */
export class SocketPty {
  private socket: net.Socket;
  private dataHandlers = new Set<(data: string) => void>();
  private exitHandlers = new Set<(info: { exitCode: number }) => void>();
  private buf = "";
  private _connected = false;

  constructor(private socketPath: string) {
    this.socket = new net.Socket();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(this.socketPath, () => {
        this._connected = true;
        resolve();
      });

      this.socket.on("data", (chunk) => {
        this.buf += chunk.toString();
        const lines = this.buf.split("\n");
        this.buf = lines.pop()!;
        for (const line of lines) {
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "output") {
              for (const h of this.dataHandlers) h(msg.data);
            } else if (msg.type === "exit") {
              for (const h of this.exitHandlers) h({ exitCode: msg.code });
            }
          } catch {}
        }
      });

      this.socket.on("error", (err) => {
        if (!this._connected) reject(err);
      });
    });
  }

  get connected(): boolean {
    return this._connected && !this.socket.destroyed;
  }

  write(data: string): void {
    this.socket.write(JSON.stringify({ type: "input", data }) + "\n");
  }

  resize(cols: number, rows: number): void {
    this.socket.write(JSON.stringify({ type: "resize", cols, rows }) + "\n");
  }

  kill(): void {
    this.socket.write(JSON.stringify({ type: "kill" }) + "\n");
  }

  onData(handler: (data: string) => void): Disposable {
    this.dataHandlers.add(handler);
    return { dispose: () => this.dataHandlers.delete(handler) };
  }

  onExit(handler: (info: { exitCode: number }) => void): Disposable {
    this.exitHandlers.add(handler);
    return { dispose: () => this.exitHandlers.delete(handler) };
  }

  disconnect(): void {
    this.socket.destroy();
    this._connected = false;
  }
}

// ── In-memory session state ──────────────────────────────────────────

interface LiveSession extends SessionInfo {
  pid: number;
  socketPath: string;
}

const sessions = new Map<string, LiveSession>();

// ── Manifest persistence ─────────────────────────────────────────────

function saveManifest(): void {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const entries: PersistedSession[] = [...sessions.values()].map((s) => ({
    id: s.id,
    pid: s.pid,
    socketPath: s.socketPath,
    command: s.command,
    cwd: s.cwd,
    startedAt: s.startedAt,
    label: s.label,
  }));
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

// ── Public API ───────────────────────────────────────────────────────

function defaultShell(): string {
  if (os.platform() === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/zsh";
}

export async function spawnSession(opts: SpawnOptions): Promise<SessionInfo> {
  const id = randomUUID();
  const socketPath = path.join(SOCKET_DIR, `pty-${id}.sock`);
  const command = opts.command || defaultShell();
  const cwd = opts.cwd || process.env.HOME || "/";

  const config = {
    socketPath,
    command,
    args: opts.args ?? [],
    cwd,
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    env: opts.env,
  };

  const child = fork(PTY_HOST, [JSON.stringify(config)], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });

  // Wait for the pty-host to signal READY over IPC
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("pty-host did not start in time"));
    }, 10_000);

    child.on("message", (msg) => {
      if (msg === "READY") {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`pty-host exited with code ${code}`));
    });
  });

  // Detach — pty-host lives on its own now
  child.disconnect();
  child.unref();

  const session: LiveSession = {
    id,
    pid: child.pid!,
    socketPath,
    command,
    cwd,
    startedAt: new Date().toISOString(),
  };

  sessions.set(id, session);
  saveManifest();
  return toInfo(session);
}

/** Connect to a session's pty-host. Each caller gets its own socket connection. */
export async function connectSession(id: string): Promise<SocketPty | undefined> {
  const session = sessions.get(id);
  if (!session) return undefined;

  const pty = new SocketPty(session.socketPath);
  try {
    await pty.connect();
  } catch {
    // Socket gone — session is dead
    sessions.delete(id);
    saveManifest();
    return undefined;
  }

  // Track exit so we can update session info
  pty.onExit(({ exitCode }) => {
    const s = sessions.get(id);
    if (s) s.exitCode = exitCode;
  });

  return pty;
}

export function getInfo(id: string): SessionInfo | undefined {
  const s = sessions.get(id);
  return s ? toInfo(s) : undefined;
}

export function listSessions(): SessionInfo[] {
  return [...sessions.values()].map(toInfo);
}

export function killSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  // Kill the pty-host process, which kills the PTY and cleans up the socket
  try { process.kill(session.pid, "SIGTERM"); } catch {}
  sessions.delete(id);
  saveManifest();
  return true;
}

export function closeAll(): void {
  // Don't kill sessions on server shutdown — that's the whole point
  // Just clear the in-memory map; they persist via manifest
}

/** Reconnect to any sessions from a previous server run. */
export async function restoreSessions(): Promise<number> {
  const persisted = loadManifest();
  let restored = 0;

  for (const entry of persisted) {
    if (!isProcessAlive(entry.pid)) {
      // Clean up stale socket
      try { fs.unlinkSync(entry.socketPath); } catch {}
      continue;
    }

    // Verify we can actually connect
    const probe = new SocketPty(entry.socketPath);
    try {
      await probe.connect();
      probe.disconnect();
    } catch {
      // Process alive but socket dead — zombie, kill it
      try { process.kill(entry.pid, "SIGTERM"); } catch {}
      try { fs.unlinkSync(entry.socketPath); } catch {}
      continue;
    }

    sessions.set(entry.id, {
      id: entry.id,
      pid: entry.pid,
      socketPath: entry.socketPath,
      command: entry.command,
      cwd: entry.cwd,
      startedAt: entry.startedAt,
      label: entry.label,
    });
    restored++;
  }

  saveManifest();
  return restored;
}

export function setSessionLabel(id: string, label: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.label = label;
  saveManifest();
  return true;
}

function toInfo(s: LiveSession): SessionInfo {
  return {
    id: s.id,
    command: s.command,
    cwd: s.cwd,
    startedAt: s.startedAt,
    exitCode: s.exitCode,
    label: s.label,
  };
}
