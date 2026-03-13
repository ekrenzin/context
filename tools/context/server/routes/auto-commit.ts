import type { FastifyInstance } from "fastify";
import type { AutoCommitService } from "../auto-commit.js";

export function registerAutoCommitRoutes(
  app: FastifyInstance,
  autoCommit: AutoCommitService,
): void {
  app.get("/api/auto-commit/status", async () => {
    return autoCommit.getStatus();
  });

  app.post("/api/auto-commit/trigger", async () => {
    autoCommit.trigger();
    return { ok: true };
  });
}
