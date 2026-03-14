import type { FastifyInstance } from "fastify";
import { getAllSettings, getSetting, setSetting } from "../db/index.js";

const ALLOWED_KEYS = [
  "ai_provider",
  "claude_auth_mode",
  "codex_auth_mode",
  "anthropic_api_key",
  "openai_api_key",
  "github_token",
  "profiler_mode",
  "ollama_model",
  "default_terminal_project",
  "nav.current",
  "nav.history",
  "remote_access_enabled",
  "tunnel_enabled",
  "tunnel_name",
  "tunnel_pin",
  "ui.colorMode",
  "terminal.open",
  "terminal.activeTab",
];

export function registerSettingsRoutes(app: FastifyInstance): void {
  app.get("/api/settings", async () => {
    const rows = getAllSettings();
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (ALLOWED_KEYS.includes(row.key)) {
        result[row.key] = row.value;
      }
    }
    return result;
  });

  app.put<{ Body: Record<string, string> }>("/api/settings", async (req) => {
    const body = req.body;
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      setSetting(key, value);
    }
    return { ok: true };
  });

  app.post<{ Body: { provider: string; apiKey: string } }>(
    "/api/settings/test-key",
    async (req, reply) => {
      const { provider, apiKey } = req.body ?? {};
      if (!provider || !apiKey) {
        return reply.code(400).send({ ok: false, error: "Missing provider or apiKey" });
      }
      try {
        const { testKey } = await import("../ai/client.js");
        const model = await testKey(provider as "anthropic" | "openai", apiKey);
        return reply.send({ ok: true, model });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[settings] test-key failed for ${provider}:`, message);
        return reply.send({ ok: false, error: message });
      }
    },
  );
}
