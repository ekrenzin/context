import fs from "fs";
import path from "path";
import os from "os";

interface AuthConfig {
  token: string;
  appUrl: string;
}

function readConfig(): AuthConfig {
  const configPath = path.join(os.homedir(), ".ctx", "auth.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) as AuthConfig;
  } catch {
    throw new Error("Not configured. Is the Context app running? Check ~/.ctx/auth.json");
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const config = readConfig();
  const url = `${config.appUrl}${endpoint}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const config = readConfig();
  const url = `${config.appUrl}${endpoint}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export function getAppUrl(): string {
  return readConfig().appUrl;
}

export function getToken(): string {
  return readConfig().token;
}
