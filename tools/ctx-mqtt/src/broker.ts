import { execSync } from "child_process";
import net from "net";
import {
  startEmbeddedBroker,
  type EmbeddedBroker,
} from "./embeddedBroker";
import {
  generateBrokerSecurity,
  type BrokerSecurity,
} from "./security";

const TCP_PORT = 1883;
const WS_PORT = 9001;

let broker: EmbeddedBroker | null = null;
let activeSecurity: BrokerSecurity | null = null;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1000);
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, "127.0.0.1");
  });
}

function killPortHolder(port: number): boolean {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(Boolean);

    if (pids.length === 0) {
      return false;
    }

    for (const pid of pids) {
      process.kill(Number(pid), "SIGTERM");
    }

    console.log(
      `[broker] Killed stale process(es) on port ${port}: ${pids.join(", ")}`,
    );

    return true;
  } catch {
    return false;
  }
}

async function clearPort(port: number): Promise<void> {
  if (await isPortOpen(port)) {
    killPortHolder(port);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function ensureBroker(_root: string): Promise<boolean> {
  await Promise.all([clearPort(TCP_PORT), clearPort(WS_PORT)]);

  activeSecurity = generateBrokerSecurity();
  broker = await startEmbeddedBroker({
    tcpPort: activeSecurity.tcpPort,
    wsPort: activeSecurity.wsPort,
    username: activeSecurity.username,
    password: activeSecurity.password,
  });

  return true;
}

export function stopBroker(): void {
  void broker?.stop();
  broker = null;
}
