import type { FastifyInstance } from "fastify";
import { getSetting } from "../db/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

interface SyncBody {
  repo: string;
}

async function ghSecretSet(repo: string, name: string, value: string): Promise<void> {
  await run("gh", ["secret", "set", name, "--repo", repo, "--body", value]);
}

export function registerDeployRoutes(app: FastifyInstance): void {
  app.post<{ Body: SyncBody }>("/api/deploy/sync-secrets", async (req, reply) => {
    const { repo } = req.body ?? {};
    if (!repo) {
      return reply.code(400).send({ ok: false, error: "Missing repo (e.g. ekrenzin/context-web)" });
    }

    const token = getSetting("cloudflare_api_token");
    const accountId = getSetting("cloudflare_account_id");

    if (!token || !accountId) {
      return reply.code(400).send({
        ok: false,
        error: "Cloudflare API token and Account ID must be set in settings first",
      });
    }

    const repos = [repo, "ekrenzin/context"];
    const unique = [...new Set(repos)];

    try {
      for (const r of unique) {
        await ghSecretSet(r, "CLOUDFLARE_API_TOKEN", token);
        await ghSecretSet(r, "CLOUDFLARE_ACCOUNT_ID", accountId);
      }
      return { ok: true };
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string }).stderr ?? "";
      const message = stderr || (err instanceof Error ? err.message : String(err));
      return reply.code(500).send({ ok: false, error: message });
    }
  });
}
