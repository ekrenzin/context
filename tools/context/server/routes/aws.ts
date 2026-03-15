import type { FastifyInstance } from "fastify";
import { execFile } from "child_process";
import { promisify } from "util";
import { getSetting } from "../db/index.js";

const execAsync = promisify(execFile);

function awsEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  const mode = getSetting("aws_auth_mode") ?? "keys";
  const region = getSetting("aws_region") ?? "us-east-1";
  env.AWS_DEFAULT_REGION = region;

  if (mode === "profile") {
    const profile = getSetting("aws_profile") ?? "";
    if (profile) env.AWS_PROFILE = profile;
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
  } else {
    const key = getSetting("aws_access_key_id") ?? "";
    const secret = getSetting("aws_secret_access_key") ?? "";
    if (key) env.AWS_ACCESS_KEY_ID = key;
    if (secret) env.AWS_SECRET_ACCESS_KEY = secret;
    delete env.AWS_PROFILE;
    delete env.AWS_SHARED_CREDENTIALS_FILE;
  }
  return env;
}

export function registerAwsRoutes(app: FastifyInstance): void {
  app.get("/api/aws/whoami", async (_req, reply) => {
    const mode = getSetting("aws_auth_mode") ?? "keys";
    if (mode === "keys") {
      const key = getSetting("aws_access_key_id");
      if (!key) return reply.code(400).send({ error: "AWS access key not configured" });
    } else {
      const profile = getSetting("aws_profile");
      if (!profile) return reply.code(400).send({ error: "AWS profile not configured" });
    }

    try {
      const { stdout } = await execAsync(
        "aws", ["sts", "get-caller-identity", "--output", "json"],
        { env: awsEnv(), timeout: 10_000 },
      );
      return JSON.parse(stdout);
    } catch (err) {
      const msg = err instanceof Error ? (err as { stderr?: string }).stderr || err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });
}
