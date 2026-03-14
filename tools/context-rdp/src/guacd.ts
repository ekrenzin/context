import { spawn, execSync, type ChildProcess } from "child_process";
import net from "net";
import os from "os";

let child: ChildProcess | null = null;

const GUACD_HOST = "127.0.0.1";
const GUACD_PORT = 4822;

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

function installGuacd(): void {
  const platform = os.platform();

  if (platform === "darwin") {
    if (!which("brew")) {
      throw new Error("Homebrew not found. Install it first: https://brew.sh");
    }
    console.log("[rdp] installing guacamole-server via brew...");
    execSync("brew install guacamole-server", { stdio: "inherit", timeout: 300_000 });
    return;
  }

  if (platform === "linux") {
    // Try apt first (Debian/Ubuntu), then yum (RHEL/Amazon Linux)
    if (which("apt-get")) {
      console.log("[rdp] installing guacd via apt...");
      execSync("sudo apt-get update && sudo apt-get install -y guacd", {
        stdio: "inherit",
        timeout: 300_000,
      });
      return;
    }
    if (which("yum")) {
      console.log("[rdp] installing guacd via yum...");
      execSync("sudo yum install -y guacd", {
        stdio: "inherit",
        timeout: 300_000,
      });
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
  proc.on("error", () => { /* handled below via spawnError check */ });
  proc.on("exit", () => { child = null; });
  return proc;
}

async function waitForSpawnError(proc: ChildProcess): Promise<Error | null> {
  return new Promise((resolve) => {
    proc.on("error", (err) => resolve(err));
    setTimeout(() => resolve(null), 500);
  });
}

export async function ensureGuacd(): Promise<void> {
  if (await isListening(GUACD_HOST, GUACD_PORT)) return;
  if (child) return;

  // If guacd binary is missing, install it
  if (!which("guacd")) {
    installGuacd();
  }

  child = spawnGuacd();
  const err = await waitForSpawnError(child);
  if (err) {
    child = null;
    throw new Error(`Failed to start guacd: ${err.message}`);
  }

  // Wait for guacd to start listening
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isListening(GUACD_HOST, GUACD_PORT)) return;
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
