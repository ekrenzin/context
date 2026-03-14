import { spawn, execSync, type ChildProcess } from "child_process";
import path from "path";
import os from "os";

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
}

/**
 * Ensure aardwolf is installed, then spawn the Python RDP bridge process.
 * Returns a handle for sending input and receiving frame/status JSON lines.
 */
export async function spawnBridge(
  opts: BridgeOptions,
  progress: ProgressCallback = noop,
): Promise<RdpBridgeProcess> {
  const pythonBin = findPython(opts.root);
  const ctxBin = findCtx(opts.root);

  // Check if aardwolf is installed
  progress("checking-deps", "Checking RDP dependencies...");
  if (!hasPkg(pythonBin, "aardwolf")) {
    installRdpDeps(pythonBin, opts.root, progress);
  }
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
  ];

  const proc = spawn(ctxBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: opts.root,
    env: { ...process.env, PYO3_USE_ABI3_FORWARD_COMPATIBILITY: "1" },
  });

  let lineCb: ((msg: Record<string, unknown>) => void) | null = null;
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
      } catch { /* skip malformed */ }
    }
  });

  proc.stderr!.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8").trim();
    if (text) console.error(`[rdp-bridge] ${text}`);
  });

  // Handle spawn errors
  const spawnErr = await new Promise<Error | null>((resolve) => {
    proc.on("error", (err) => resolve(err));
    setTimeout(() => resolve(null), 1000);
  });

  if (spawnErr) {
    throw new Error(`Failed to start RDP bridge: ${spawnErr.message}`);
  }

  return {
    proc,
    send: (msg) => {
      if (!proc.stdin!.destroyed) {
        proc.stdin!.write(JSON.stringify(msg) + "\n");
      }
    },
    onLine: (cb) => { lineCb = cb; },
    kill: () => {
      if (!proc.killed) {
        proc.stdin!.write(JSON.stringify({ type: "disconnect" }) + "\n");
        setTimeout(() => { if (!proc.killed) proc.kill(); }, 2000);
      }
    },
  };
}
