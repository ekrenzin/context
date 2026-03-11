import * as http from "http";
import { ChildProcess, spawn } from "child_process";

export interface ManagedProcess {
  process: ChildProcess;
  stop: () => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probe(port: number, endpoint = "/"): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: endpoint,
        timeout: 1200,
      },
      (res) => resolve((res.statusCode ?? 500) < 500),
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function waitForHttp(port: number, endpoint = "/", timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe(port, endpoint)) return;
    await delay(300);
  }
  throw new Error(`Service on port ${port} did not become ready.`);
}

export function spawnManagedProcess(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  onLine: (line: string) => void,
  onError: (message: string) => void,
): ManagedProcess {
  const process = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const capture = (prefix: "OUT" | "ERR", chunk: Buffer) => {
    const lines = chunk.toString().split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) onLine(`[${prefix}] ${line}`);
  };

  process.stdout?.on("data", (chunk: Buffer) => capture("OUT", chunk));
  process.stderr?.on("data", (chunk: Buffer) => capture("ERR", chunk));
  process.on("error", (err) => onError(err.message));

  return {
    process,
    stop: () => process.kill("SIGTERM"),
  };
}
