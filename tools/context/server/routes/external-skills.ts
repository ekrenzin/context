import type { FastifyInstance } from "fastify";
import type { SkillsSyncer } from "../skills-syncer.js";

export function registerExternalSkillRoutes(
  app: FastifyInstance,
  syncer: SkillsSyncer,
): void {
  app.get("/api/skills/external", async () => syncer.getStatus());

  app.post("/api/skills/external/sync", async () => {
    const status = await syncer.sync();
    return status;
  });
}
