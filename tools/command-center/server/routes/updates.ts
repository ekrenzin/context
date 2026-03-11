import type { FastifyInstance } from "fastify";
import type { UpdateChecker } from "../update-checker.js";

export function registerUpdateRoutes(
  app: FastifyInstance,
  checker: UpdateChecker,
): void {
  app.get("/api/updates", async () => checker.getStatus());

  app.post("/api/updates/check", async () => {
    const status = await checker.check();
    return status;
  });

  app.post("/api/updates/pull", async () => {
    const status = await checker.pull();
    return status;
  });
}
