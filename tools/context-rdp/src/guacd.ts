import { spawn, type ChildProcess } from "child_process";
import net from "net";

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

export async function ensureGuacd(): Promise<void> {
  if (await isListening(GUACD_HOST, GUACD_PORT)) return;

  if (child) return;

  try {
    child = spawn("guacd", ["-f", "-b", GUACD_HOST, "-l", String(GUACD_PORT)], {
      stdio: "pipe",
    });
  } catch {
    child = null;
    throw new Error(
      "guacd not found. Install it: brew install guacamole-server (macOS) or apt install guacd (Linux)",
    );
  }

  // Catch spawn errors (ENOENT etc.) so they don't crash the process
  const spawnError = await new Promise<Error | null>((resolve) => {
    child!.on("error", (err) => {
      child = null;
      resolve(err);
    });
    child!.on("exit", () => {
      child = null;
    });
    // If no error within 500ms, assume spawn succeeded
    setTimeout(() => resolve(null), 500);
  });

  if (spawnError) {
    throw new Error(
      "guacd not found. Install it: brew install guacamole-server (macOS) or apt install guacd (Linux)",
    );
  }

  // Wait for guacd to start listening
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isListening(GUACD_HOST, GUACD_PORT)) return;
  }

  throw new Error(
    "guacd did not start. Install it: brew install guacamole-server (macOS) or apt install guacd (Linux)",
  );
}

export function stopGuacd(): void {
  if (child) {
    child.kill();
    child = null;
  }
}

export { GUACD_HOST, GUACD_PORT };
