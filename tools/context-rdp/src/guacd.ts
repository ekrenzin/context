import { spawn, execSync, type ChildProcess } from "child_process";
import net from "net";
import os from "os";

let child: ChildProcess | null = null;

const GUACD_HOST = "127.0.0.1";
const GUACD_PORT = 4822;

export type ProgressCallback = (phase: string, message: string) => void;

const noop: ProgressCallback = () => {};

async function isListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    sock.setTimeout(1000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function which(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installGuacd(progress: ProgressCallback): void {
  const platform = os.platform();

  if (platform === "darwin") {
    if (!which("brew")) {
      throw new Error("Homebrew not found. Install it first: https://brew.sh");
    }
    progress("installing-guacd", "Installing guacamole-server via Homebrew (this may take a few minutes)...");
    execSync("brew install guacamole-server", { stdio: "inherit", timeout: 300_000 });
    progress("installing-guacd", "guacamole-server installed successfully");
    return;
  }

  if (platform === "linux") {
    if (which("apt-get")) {
      progress("installing-guacd", "Installing guacd via apt (this may take a minute)...");
      execSync("sudo apt-get update && sudo apt-get install -y guacd", {
        stdio: "inherit",
        timeout: 300_000,
      });
      progress("installing-guacd", "guacd installed successfully");
      return;
    }
    if (which("yum")) {
      progress("installing-guacd", "Installing guacd via yum...");
      execSync("sudo yum install -y guacd", {
        stdio: "inherit",
        timeout: 300_000,
      });
      progress("installing-guacd", "guacd installed successfully");
      return;
    }
    throw new Error("No supported package manager found (apt-get, yum)");
  }

  throw new Error(`Unsupported platform: ${platform}. Install guacd manually.`);
}

function spawnGuacd(): ChildProcess {
  const proc = spawn("guacd", ["-f", "-b", GUACD_HOST, "-l", String(GUACD_PORT)], {
    stdio: "pipe",
  });
  proc.on("error", () => { /* handled via waitForSpawnError */ });
  proc.on("exit", () => { child = null; });
  return proc;
}

async function waitForSpawnError(proc: ChildProcess): Promise<Error | null> {
  return new Promise((resolve) => {
    proc.on("error", (err) => resolve(err));
    setTimeout(() => resolve(null), 500);
  });
}

export async function ensureGuacd(progress: ProgressCallback = noop): Promise<void> {
  progress("checking-guacd", "Checking if guacd is running...");

  if (await isListening(GUACD_HOST, GUACD_PORT)) {
    progress("ready", "guacd is already running");
    return;
  }

  if (child) {
    progress("starting-guacd", "guacd is starting up...");
    return;
  }

  if (!which("guacd")) {
    progress("installing-guacd", "guacd not found, installing...");
    installGuacd(progress);
  }

  progress("starting-guacd", "Starting guacd...");
  child = spawnGuacd();
  const err = await waitForSpawnError(child);
  if (err) {
    child = null;
    throw new Error(`Failed to start guacd: ${err.message}`);
  }

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isListening(GUACD_HOST, GUACD_PORT)) {
      progress("ready", "guacd is running");
      return;
    }
  }

  throw new Error("guacd spawned but never started listening on port 4822");
}

export function stopGuacd(): void {
  if (child) {
    child.kill();
    child = null;
  }
}

export { GUACD_HOST, GUACD_PORT };
