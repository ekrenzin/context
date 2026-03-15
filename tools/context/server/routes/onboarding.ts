import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import { SOLUTION_EXAMPLES } from "../solutions/examples.js";
import { setSetting } from "../db/index.js";

export function registerOnboardingRoutes(app: FastifyInstance, root: string): void {
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

  app.post<{ Body: { problem: string; name: string; tool: "claude" | "codex" } }>(
    "/api/onboarding/propose",
    async (req, reply) => {
      const { problem, name, tool } = req.body ?? {};
      if (!problem?.trim() || !name?.trim()) {
        return reply.code(400).send({ error: "problem and name are required" });
      }
      if (tool !== "claude" && tool !== "codex") {
        return reply.code(400).send({ error: "tool must be claude or codex" });
      }

      const skillPath = path.join(root, "skills", "proposals", "SKILL.md");
      let skillContext = "";
      if (fs.existsSync(skillPath)) {
        skillContext = fs.readFileSync(skillPath, "utf8");
      }

      const slug = name.replace(/[^a-z0-9-]/g, "");
      const today = new Date().toISOString().slice(0, 10);

      const prompt = [
        "You are creating a design proposal for the Context workspace.",
        "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
        "",
        "# Proposals Skill Reference",
        "",
        skillContext,
        "",
        "# Problem to Solve",
        "",
        problem.trim(),
        "",
        "# Instructions",
        "",
        `Create a proposal in docs/proposals/${slug}/`,
        "",
        `1. Write PROPOSAL.md with frontmatter: title, date: ${today}, status: draft.`,
        "2. Write impact.md listing affected files, systems, and risks.",
        "3. Break the work into numbered task files (01-<name>.md, 02-<name>.md, etc.).",
        "   Each task file needs frontmatter: task, agent, model, depends_on, status: pending.",
        "4. Be thorough but concise. Do NOT ask questions -- generate the full proposal directly.",
        "",
        "This is a non-interactive session. Generate everything and exit when done.",
      ].join("\n");

      const { spawnSession } = await import("../terminal/manager.js");

      const cmd = tool;
      const userPrompt = `Create a design proposal for: ${problem.trim()}`;
      const args = cmd === "claude"
        ? [
          "--dangerously-skip-permissions",
          "--append-system-prompt", prompt,
          userPrompt,
        ]
        : [
          "--full-auto",
          `${prompt}\n\n---\n\n${userPrompt}`,
        ];

      const session = await spawnSession({ command: cmd, args, cwd: root });

      return { sessionId: session.id, slug };
    },
  );

  app.post<{ Body: { persona?: string; intents?: string[]; intentFreeform?: string; branding?: unknown; solutionId?: string } }>(
    "/api/onboarding/complete",
    async (req) => {
      const { persona, intents, intentFreeform } = req.body;
      if (persona) setSetting("persona", persona);
      if (intents) setSetting("intents", JSON.stringify(intents));
      if (intentFreeform) setSetting("intent_freeform", intentFreeform);
      setSetting("onboarding_complete", "true");
      return { ok: true };
    },
  );
}
