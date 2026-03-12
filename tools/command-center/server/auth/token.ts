import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const AUTH_DIR = path.join(os.homedir(), ".ctx");
const AUTH_FILE = path.join(AUTH_DIR, "auth.json");

export interface AuthConfig {
  token: string;
  appUrl: string;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function readAuthConfig(): AuthConfig | null {
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(raw) as AuthConfig;
  } catch {
    return null;
  }
}

export function writeAuthConfig(config: AuthConfig): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function ensureAuthToken(appUrl: string): string {
  const existing = readAuthConfig();
  if (existing?.token) {
    if (existing.appUrl !== appUrl) {
      writeAuthConfig({ token: existing.token, appUrl });
    }
    return existing.token;
  }

  const token = generateToken();
  writeAuthConfig({ token, appUrl });
  return token;
}
