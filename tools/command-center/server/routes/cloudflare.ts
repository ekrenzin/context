import { spawn } from "child_process";
import type { FastifyInstance } from "fastify";

interface CloudflareStatus {
  connected: boolean;
  account?: string;
  error?: string;
}

interface DeployRequest {
  projectDir: string;
  buildCommand?: string;
  outputDir?: string;
}

interface DeployResult {
  success: boolean;
  url?: string;
  error?: string;
}

function runCommand(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const { cwd, timeoutMs = 15000 } = options;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ stdout, stderr: stderr + "\nProcess timed out", code: 1 });
    }, timeoutMs);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, code: 1 });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function checkWranglerAuth(): Promise<CloudflareStatus> {
  const result = await runCommand("wrangler", ["whoami"]);
  if (result.code !== 0) {
    const notInstalled =
      result.stderr.includes("not found") ||
      result.stderr.includes("ENOENT");
    if (notInstalled) {
      return { connected: false, error: "wrangler not installed" };
    }
    return { connected: false, error: result.stderr.trim() || "Not authenticated" };
  }
  const match = result.stdout.match(/associated with the (?:account|API Token) "?(.+?)"?\s/);
  const account = match?.[1] ?? result.stdout.trim().split("\n").pop();
  return { connected: true, account };
}

async function handleConnect(): Promise<CloudflareStatus> {
  const loginChild = spawn("wrangler", ["login"], { shell: true });
  loginChild.on("error", () => { /* handled by polling */ });

  const maxWaitMs = 120_000;
  const pollIntervalMs = 2_000;
  const start = Date.now();

  return new Promise<CloudflareStatus>((resolve) => {
    const poll = async () => {
      if (Date.now() - start > maxWaitMs) {
        loginChild.kill("SIGTERM");
        resolve({ connected: false, error: "Authorization timed out after 120s" });
        return;
      }
      const status = await checkWranglerAuth();
      if (status.connected) {
        loginChild.kill("SIGTERM");
        resolve(status);
        return;
      }
      setTimeout(poll, pollIntervalMs);
    };
    setTimeout(poll, pollIntervalMs);
  });
}

export async function registerCloudflareRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/integrations/cloudflare/status", async () => {
    return checkWranglerAuth();
  });

  app.post("/api/integrations/cloudflare/connect", async (_req, reply) => {
    const result = await handleConnect();
    reply.status(result.connected ? 200 : 408);
    return result;
  });

  app.post<{ Body: DeployRequest }>(
    "/api/deploy/cloudflare",
    async (req, reply) => {
      const {
        projectDir,
        buildCommand = "npm run build",
        outputDir = "dist",
      } = req.body ?? {};

      if (!projectDir) {
        reply.status(400);
        return { success: false, error: "projectDir is required" };
      }

      return runDeploy({ projectDir, buildCommand, outputDir, reply });
    },
  );
}

async function runDeploy(opts: {
  projectDir: string;
  buildCommand: string;
  outputDir: string;
  reply: import("fastify").FastifyReply;
}): Promise<DeployResult> {
  const { projectDir, buildCommand, outputDir } = opts;

  // Check auth first
  const auth = await checkWranglerAuth();
  if (!auth.connected) {
    opts.reply.status(401);
    return { success: false, error: auth.error ?? "Not authenticated with Cloudflare" };
  }

  // Run build
  const [buildCmd, ...buildArgs] = buildCommand.split(" ");
  const buildResult = await runCommand(buildCmd, buildArgs, {
    cwd: projectDir,
    timeoutMs: 120_000,
  });
  if (buildResult.code !== 0) {
    return {
      success: false,
      error: `Build failed: ${buildResult.stderr || buildResult.stdout}`,
    };
  }

  // Run deploy
  const deployResult = await runCommand(
    "wrangler",
    ["pages", "deploy", outputDir],
    { cwd: projectDir, timeoutMs: 120_000 },
  );
  if (deployResult.code !== 0) {
    return {
      success: false,
      error: `Deploy failed: ${deployResult.stderr || deployResult.stdout}`,
    };
  }

  const urlMatch = deployResult.stdout.match(
    /https:\/\/[a-zA-Z0-9-]+\.pages\.dev[^\s]*/,
  );
  return { success: true, url: urlMatch?.[0] };
}
