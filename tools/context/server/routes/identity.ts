import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import type { FastifyInstance } from "fastify";
import type { IdentityProvider, IdentitySnapshot } from "../types.js";

interface CommandResult {
  ok: boolean;
  output?: string;
  error?: string;
}

function runCommand(command: string, args: string[], timeoutMs = 2000): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, encoding: "utf8" }, (error, stdout) => {
      if (error) {
        resolve({ ok: false, error: error.message });
        return;
      }
      resolve({ ok: true, output: stdout.trim() });
    });
  });
}

async function getGithubIdentity(): Promise<IdentityProvider> {
  const result = await runCommand("gh", ["api", "user"]);
  if (!result.ok || !result.output) {
    return { provider: "github", status: "disconnected", detail: "Not authenticated in gh CLI." };
  }

  try {
    const user = JSON.parse(result.output) as { login?: string; name?: string; email?: string };
    if (!user.login) {
      return { provider: "github", status: "disconnected", detail: "GitHub user not available." };
    }
    return {
      provider: "github",
      status: "connected",
      username: user.login,
      displayName: user.name ?? user.login,
      email: user.email ?? undefined,
      detail: "Resolved from gh CLI session.",
    };
  } catch {
    return { provider: "github", status: "disconnected", detail: "Invalid response from gh CLI." };
  }
}

async function getAwsIdentity(): Promise<IdentityProvider> {
  // SSO credentials require a network round-trip to exchange the cached token;
  // 2s is insufficient. Allow up to 10s before reporting disconnected.
  const result = await runCommand("aws", ["sts", "get-caller-identity", "--output", "json"], 10000);
  if (!result.ok || !result.output) {
    return { provider: "aws", status: "disconnected", detail: "AWS CLI session not found." };
  }

  try {
    const identity = JSON.parse(result.output) as { Arn?: string; Account?: string };
    if (!identity.Arn) {
      return { provider: "aws", status: "disconnected", detail: "AWS identity ARN unavailable." };
    }
    const username = identity.Arn.split("/").pop() || identity.Arn;
    return {
      provider: "aws",
      status: "connected",
      username,
      displayName: username,
      accountId: identity.Account ?? undefined,
      detail: "Resolved from AWS STS caller identity.",
    };
  } catch {
    return { provider: "aws", status: "disconnected", detail: "Invalid response from AWS CLI." };
  }
}

function getCursorIdentity(): IdentityProvider {
  const configPath = path.join(os.homedir(), ".cursor", "cli-config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      authInfo?: { email?: string; displayName?: string; teamName?: string };
    };
    const authInfo = parsed.authInfo;
    if (!authInfo) {
      return { provider: "cursor", status: "disconnected", detail: "Cursor auth info not present." };
    }
    return {
      provider: "cursor",
      status: "connected",
      username: authInfo.email ?? authInfo.displayName ?? "cursor-user",
      displayName: authInfo.displayName ?? authInfo.email ?? "Cursor User",
      email: authInfo.email ?? undefined,
      team: authInfo.teamName ?? undefined,
      detail: "Resolved from Cursor CLI auth info.",
    };
  } catch {
    return { provider: "cursor", status: "unknown", detail: "Unable to read Cursor CLI auth info." };
  }
}

async function loadIdentitySnapshot(): Promise<IdentitySnapshot> {
  const [github, aws] = await Promise.all([getGithubIdentity(), getAwsIdentity()]);
  const cursor = getCursorIdentity();
  return {
    github,
    cursor,
    aws,
    updatedAt: new Date().toISOString(),
  };
}

export function registerIdentityRoutes(app: FastifyInstance): void {
  app.get("/api/identities", async () => {
    return loadIdentitySnapshot();
  });
}
