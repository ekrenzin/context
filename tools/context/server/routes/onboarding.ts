import type { FastifyInstance } from "fastify";
import { SOLUTION_EXAMPLES } from "../solutions/examples.js";
import { setSetting } from "../db/index.js";

export function registerOnboardingRoutes(app: FastifyInstance, _root: string): void {
  app.get("/api/solutions/examples", async () => SOLUTION_EXAMPLES);

  app.post<{ Body: { description: string } }>(
    "/api/onboarding/ui-preferences",
    async (req, reply) => {
      const { description } = req.body ?? {};
      if (!description?.trim()) {
        return reply.code(400).send({ ok: false, error: "Missing description" });
      }

      try {
        const { complete } = await import("../ai/client.js");
        const { UI_PREFERENCES_SYSTEM, uiPreferencesPrompt } = await import("../ai/prompts.js");

        const result = await complete({
          system: UI_PREFERENCES_SYSTEM,
          prompt: uiPreferencesPrompt(description.trim()),
          maxTokens: 1024,
          temperature: 0.3,
        });

        const cleaned = result.text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const config = JSON.parse(cleaned);

        if (!config.dark?.primary || !config.light?.primary) {
          return reply.code(422).send({ ok: false, error: "Invalid config structure" });
        }

        setSetting("branding", JSON.stringify(config));
        return { ok: true, config };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[onboarding] ui-preferences failed:", message);
        return reply.code(500).send({ ok: false, error: message });
      }
    },
  );

  app.post<{ Body: { persona?: string; branding?: unknown; solutionId?: string } }>(
    "/api/onboarding/complete",
    async (req) => {
      const { persona } = req.body;
      if (persona) setSetting("persona", persona);
      setSetting("onboarding_complete", "true");
      return { ok: true };
    },
  );
}
