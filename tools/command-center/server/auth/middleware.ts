import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

const EXEMPT_PREFIXES = [
  "/api/status",
  "/api/onboarding",
  "/api/branding",
  "/api/settings",
  "/api/views",
  "/api/sessions",
  "/api/session-logs",
  "/api/stats",
  "/api/config",
  "/api/agents",
  "/api/updates",
  "/api/logs",
  "/api/projects",
  "/api/solutions",
  "/api/ides",
  "/api/fs",
  "/api/terminal",
  "/api/ollama",
];
const EXEMPT_EXACT = new Set(["/api/health"]);

let serverToken: string | null = null;

export function setServerToken(token: string): void {
  serverToken = token;
}

function isExempt(url: string): boolean {
  if (EXEMPT_EXACT.has(url)) return true;
  for (const prefix of EXEMPT_PREFIXES) {
    if (url.startsWith(prefix)) return true;
  }
  return !url.startsWith("/api/");
}

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/ctx_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (isExempt(req.url)) return;
    if (!serverToken) return;

    const token = extractToken(req);
    if (token !== serverToken) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
