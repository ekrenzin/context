import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import path from "path";
import { createInterface } from "readline";

const LOG_TAIL_SIZE = 30;
const KILL_TIMEOUT_MS = 5000;

export function startService(
  solutionDir: string,
  port: number,
  entrypoint = "server/index.ts",
  env?: Record<string, string>,
  cmdCenterDir?: string,
): { pid: number; logTail: string[]; process: ChildProcess } {
  const entryPath = path.join(solutionDir, entrypoint);
  const logTail: string[] = [];

  const nodeModules = cmdCenterDir
    ? path.join(cmdCenterDir, "node_modules")
    : undefined;
  const tsxBin = nodeModules
    ? path.join(nodeModules, ".bin", "tsx")
    : "tsx";

  const baseEnv: Record<string, string> = {
    PORT: String(port),
    MQTT_URL: "mqtt://127.0.0.1:1883",
    ...env,
  };
  if (nodeModules) {
    baseEnv.NODE_PATH = nodeModules;
  }

  const proc: ChildProcess = spawn(tsxBin, [entryPath], {
    cwd: solutionDir,
    env: { ...process.env, ...baseEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!proc.pid) {
    throw new Error("Failed to spawn service process");
  }

  const pushLine = (line: string) => {
    logTail.push(line);
    if (logTail.length > LOG_TAIL_SIZE) logTail.shift();
  };

  if (proc.stdout) {
    const rl = createInterface({ input: proc.stdout });
    rl.on("line", pushLine);
  }
  if (proc.stderr) {
    const rl = createInterface({ input: proc.stderr });
    rl.on("line", pushLine);
  }

  return { pid: proc.pid, logTail, process: proc };
}

export async function stopService(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    const deadline = Date.now() + KILL_TIMEOUT_MS;
    const check = () => {
      try {
        process.kill(pid, 0);
        if (Date.now() >= deadline) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // already gone
          }
          resolve();
          return;
        }
        setTimeout(check, 200);
      } catch {
        resolve();
      }
    };
    setTimeout(check, 200);
  });
}

export async function checkHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
