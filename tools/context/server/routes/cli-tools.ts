import type { FastifyInstance } from "fastify";
import {
  claudeCliStatus,
  codexCliStatus,
  cloudflaredCliStatus,
  installNpmPackage,
  installCloudflared,
} from "../ai/cli-tools.js";

export function registerCliToolsRoutes(app: FastifyInstance): void {
  app.get("/api/cli-tools/status", async () => {
    return {
      claude: claudeCliStatus(),
      codex: codexCliStatus(),
      cloudflared: cloudflaredCliStatus(),
    };
  });

  app.post<{ Body: { tool: string } }>(
    "/api/cli-tools/install",
    async (req, reply) => {
      const { tool } = req.body ?? {};

      if (tool === "cloudflared") {
        return await installCloudflared();
      }

      const packages: Record<string, string> = {
        claude: "@anthropic-ai/claude-code",
        codex: "@openai/codex",
      };

      const pkg = packages[tool];
      if (!pkg) {
        return reply.code(400).send({ success: false, error: "Unknown tool" });
      }

      const result = await installNpmPackage(pkg);
      return result;
    },
  );
}
