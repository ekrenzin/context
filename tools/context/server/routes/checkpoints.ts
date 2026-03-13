import { execSync } from "child_process";
import type { FastifyInstance } from "fastify";

interface Checkpoint {
  sha: string;
  message: string;
  date: string;
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

export function registerCheckpointRoutes(
  app: FastifyInstance,
  root: string,
): void {
  app.get("/api/checkpoints", async () => {
    try {
      const raw = git(
        'log --format="%H||%s||%cI" -20',
        root,
      );
      if (!raw) return [];
      return raw.split("\n").map((line): Checkpoint => {
        const [sha, message, date] = line.split("||");
        return { sha, message, date };
      });
    } catch {
      return [];
    }
  });

  app.post<{ Body: { sha: string } }>(
    "/api/checkpoints/restore",
    async (req, reply) => {
      const { sha } = req.body;
      if (!sha || !/^[a-f0-9]{7,40}$/.test(sha)) {
        return reply.status(400).send({ error: "invalid sha" });
      }

      try {
        // Stash any uncommitted work
        const dirty =
          git("status --porcelain", root).length > 0;
        if (dirty) {
          git("stash push -m checkpoint-restore", root);
        }

        git(`reset --hard ${sha}`, root);
        return { ok: true, sha, stashed: dirty };
      } catch (err) {
        return reply.status(500).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
