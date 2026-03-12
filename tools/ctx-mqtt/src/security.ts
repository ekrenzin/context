import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export interface BrokerSecurity {
  username: string;
  password: string;
  configDir: string;
  tcpPort: number;
  wsPort: number;
}

export interface BrokerCredentials {
  username: string;
  password: string;
  brokerCertPath: string | null;
  tcpPort: number;
  wsPort: number;
}

const CONFIG_DIR = path.join(os.homedir(), ".ctx", "mqtt");
const TCP_PORT = 1883;
const WS_PORT = 9001;

export function generateBrokerSecurity(externalToken?: string): BrokerSecurity {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

  const username = "ctx";
  const password = externalToken ?? crypto.randomBytes(32).toString("hex");

  const creds: BrokerCredentials = {
    username,
    password,
    brokerCertPath: null,
    tcpPort: TCP_PORT,
    wsPort: WS_PORT,
  };

  fs.writeFileSync(
    path.join(CONFIG_DIR, "credentials.json"),
    JSON.stringify(creds),
    { mode: 0o600 },
  );

  return { username, password, configDir: CONFIG_DIR, tcpPort: TCP_PORT, wsPort: WS_PORT };
}

export function readCredentials(): BrokerCredentials | null {
  const credsPath = path.join(CONFIG_DIR, "credentials.json");
  try {
    return JSON.parse(fs.readFileSync(credsPath, "utf-8"));
  } catch {
    return null;
  }
}
