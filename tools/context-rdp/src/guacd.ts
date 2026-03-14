import { spawn, execSync, type ChildProcess } from "child_process";
import * as net from "net";
import path from "path";

export type ProgressCallback = (phase: string, message: string) => void;
const noop: ProgressCallback = () => {};

function findPython(root: string): string {
  const isWin = process.platform === "win32";
  return isWin
    ? path.join(root, "tools", ".venv", "Scripts", "python.exe")
    : path.join(root, "tools", ".venv", "bin", "python");
}

function findCtx(root: string): string {
  const isWin = process.platform === "win32";
  return isWin
    ? path.join(root, "tools", ".venv", "Scripts", "ctx.exe")
    : path.join(root, "tools", ".venv", "bin", "ctx");
}

function hasPkg(pythonBin: string, pkg: string): boolean {
  try {
    execSync(`${pythonBin} -c "import ${pkg}"`, { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function installRdpDeps(pythonBin: string, root: string, progress: ProgressCallback): void {
  progress("installing-deps", "Installing RDP dependencies (aardwolf, Pillow)...");
  const pip = pythonBin.replace(/python[^/\\]*$/, "pip");
  const env = { ...process.env, PYO3_USE_ABI3_FORWARD_COMPATIBILITY: "1" };
  try {
    execSync(
      `${pip} install "aardwolf>=0.2.0" "Pillow>=10.0.0"`,
      { cwd: root, stdio: "pipe", timeout: 300_000, env },
    );
    progress("installing-deps", "RDP dependencies installed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to install RDP dependencies: ${msg}`);
  }
}

export interface RdpBridgeProcess {
  proc: ChildProcess;
  pid: number;
  socketPath: string;
  send: (msg: Record<string, unknown>) => void;
  onLine: (cb: (msg: Record<string, unknown>) => void) => void;
  kill: () => void;
}

export interface BridgeOptions {
  root: string;
  host: string;
  port: number;
  username: string;
  password: string;
  domain?: string;
  width?: number;
  height?: number;
  socketPath: string;
}

function ensureDeps(root: string, progress: ProgressCallback): void {
  const pythonBin = findPython(root);
  progress("checking-deps", "Checking RDP dependencies...");
  if (!hasPkg(pythonBin, "aardwolf")) {
    installRdpDeps(pythonBin, root, progress);
  }
}

/**
 * Spawn the Python RDP bridge in socket mode. The bridge listens on a Unix
 * socket so it can outlive the WebSocket connection and accept reconnections.
 */
export async function spawnBridge(
  opts: BridgeOptions,
  progress: ProgressCallback = noop,
): Promise<RdpBridgeProcess> {
  const ctxBin = findCtx(opts.root);

  ensureDeps(opts.root, progress);
  progress("starting-bridge", "Starting RDP bridge...");

  const args = [
    "rdp", "connect",
    "--host", opts.host,
    "--port", String(opts.port),
    "--username", opts.username,
    "--password", opts.password,
    "--domain", opts.domain ?? "",
    "--width", String(opts.width ?? 1280),
    "--height", String(opts.height ?? 720),
    "--socket", opts.socketPath,
  ];

  const proc = spawn(ctxBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: opts.root,
    detached: true,
    env: { ...process.env, PYO3_USE_ABI3_FORWARD_COMPATIBILITY: "1" },
  });

  // Read stdout for status/ready messages during startup
  let lineCb: ((msg: Record<string, unknown>) => void) | null = null;
  const pendingMessages: Record<string, unknown>[] = [];
  let buffer = "";

  proc.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf-8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (lineCb) lineCb(msg);
        else pendingMessages.push(msg);
      } catch { /* skip malformed */ }
    }
  });

  proc.stderr!.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8").trim();
    if (text) console.error(`[rdp-bridge] ${text}`);
  });

  // Wait for the bridge to report READY (connected + socket listening)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Bridge did not connect in time")), 60_000);

    const origLineCb = lineCb;
    lineCb = (msg) => {
      // Forward status messages to the progress callback
      if (msg.type === "status") {
        progress(msg.phase as string, msg.message as string);
      }
      if (msg.type === "error") {
        clearTimeout(timeout);
        reject(new Error(msg.message as string));
        return;
      }
      if (msg.type === "ready") {
        clearTimeout(timeout);
        lineCb = origLineCb;
        resolve();
        return;
      }
      // Buffer non-ready messages
      pendingMessages.push(msg);
    };

    proc.on("error", (err) => { clearTimeout(timeout); reject(err); });
    proc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Bridge exited during startup (code ${code})`));
    });
  });

  // Detach -- bridge lives independently
  proc.unref();

  return {
    proc,
    pid: proc.pid!,
    socketPath: opts.socketPath,
    send: () => { /* input goes via socket clients, not stdin */ },
    onLine: (cb) => {
      lineCb = cb;
      for (const msg of pendingMessages) cb(msg);
      pendingMessages.length = 0;
    },
    kill: () => {
      if (!proc.killed) {
        try { process.kill(proc.pid!, "SIGTERM"); } catch {}
      }
    },
  };
}

/** Connect to an already-running bridge via its Unix socket. */
export class BridgeSocket {
  private socket: net.Socket;
  private dataHandlers = new Set<(msg: Record<string, unknown>) => void>();
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
            for (const h of this.dataHandlers) h(msg);
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

  send(msg: Record<string, unknown>): void {
    if (this.connected) {
      this.socket.write(JSON.stringify(msg) + "\n");
    }
  }

  onData(handler: (msg: Record<string, unknown>) => void): () => void {
    this.dataHandlers.add(handler);
    return () => { this.dataHandlers.delete(handler); };
  }

  disconnect(): void {
    this.socket.destroy();
    this._connected = false;
  }
}
