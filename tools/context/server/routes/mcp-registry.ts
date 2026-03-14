import type { FastifyInstance } from "fastify";
import type { McpSync } from "../mcp-sync/index.js";
import { searchRegistry } from "../mcp-sync/registry.js";
import {
  listMcpServers,
  getMcpServer,
  upsertMcpServer,
  toggleMcpServer,
  updateMcpServerEnv,
  deleteMcpServer,
} from "../db/queries/mcp-servers.js";
import type { McpServerInput } from "../db/queries/mcp-servers.js";

export function registerMcpRegistryRoutes(
  app: FastifyInstance,
  mcpSync: McpSync,
): void {
  // Browse the upstream registry (GitHub Search API)
  app.get<{ Querystring: { search?: string; page?: string; limit?: string } }>(
    "/api/mcp/registry",
    async (req) => {
      const { search, page, limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : undefined;
      return searchRegistry(search, pageNum, limitNum);
    },
  );

  // List installed servers
  app.get("/api/mcp/installed", async () => {
    return listMcpServers();
  });

  // Install a server
  app.post<{ Body: McpServerInput }>("/api/mcp/installed", async (req, reply) => {
    const { id, name, namespace, command, args, env, targets } = req.body;
    if (!id || !name || !command) {
      return reply.code(400).send({ error: "id, name, and command required" });
    }
    upsertMcpServer({
      id,
      name,
      namespace: namespace ?? "unknown",
      command,
      args: args ?? [],
      env: env ?? {},
      targets,
    });
    const result = await mcpSync.sync();
    return { ok: true, server: getMcpServer(id), written: result.written };
  });

  // Update a server (env, enabled, targets)
  app.patch<{
    Params: { id: string };
    Body: { enabled?: boolean; env?: Record<string, string> };
  }>("/api/mcp/installed/:id", async (req, reply) => {
    const { id } = req.params;
    const existing = getMcpServer(id);
    if (!existing) {
      return reply.code(404).send({ error: "Server not found" });
    }
    if (req.body.enabled !== undefined) {
      toggleMcpServer(id, req.body.enabled);
    }
    if (req.body.env) {
      updateMcpServerEnv(id, req.body.env);
    }
    const result = await mcpSync.sync();
    return { ok: true, server: getMcpServer(id), written: result.written };
  });

  // Uninstall a server
  app.delete<{ Params: { id: string } }>(
    "/api/mcp/installed/:id",
    async (req, reply) => {
      const { id } = req.params;
      const existing = getMcpServer(id);
      if (!existing) {
        return reply.code(404).send({ error: "Server not found" });
      }
      deleteMcpServer(id);
      const result = await mcpSync.sync();
      return { ok: true, written: result.written };
    },
  );

  // Force sync now
  app.post("/api/mcp/sync", async () => {
    const result = await mcpSync.sync();
    return { ok: true, ...result };
  });
}
