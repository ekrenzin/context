import type { FastifyInstance } from "fastify";
import type { McpSync } from "../mcp-sync/index.js";
import { getProject } from "../db/index.js";
import {
  getResolvedServers,
  setProjectMcpServer,
  removeProjectMcpServer,
  upsertMcpServer,
  getMcpServer,
} from "../db/queries/mcp-servers.js";
import type { McpServerInput } from "../db/queries/mcp-servers.js";

export function registerProjectMcpRoutes(
  app: FastifyInstance,
  mcpSync: McpSync,
): void {
  // Resolved server list for a project
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/mcp",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });
      return getResolvedServers(req.params.id);
    },
  );

  // Add or override a server for this project
  app.post<{ Params: { id: string }; Body: McpServerInput & { env?: Record<string, string> } }>(
    "/api/projects/:id/mcp",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const { id: serverId } = req.body;
      // If server doesn't exist in workspace catalog, install it first
      if (!getMcpServer(serverId)) {
        const { id, name, namespace, command, args, env, targets } = req.body;
        if (!id || !name || !command) {
          return reply.code(400).send({ error: "id, name, and command required" });
        }
        upsertMcpServer({
          id, name, namespace: namespace ?? "unknown",
          command, args: args ?? [], env: env ?? {}, targets,
        });
      }

      setProjectMcpServer(req.params.id, serverId, {
        enabled: true,
        env: req.body.env ?? {},
      });
      const result = await mcpSync.sync();
      return { ok: true, servers: getResolvedServers(req.params.id), written: result.written };
    },
  );

  // Update override (toggle, env)
  app.patch<{
    Params: { id: string; sid: string };
    Body: { enabled?: boolean; env?: Record<string, string> };
  }>(
    "/api/projects/:id/mcp/:sid",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      setProjectMcpServer(req.params.id, req.params.sid, {
        enabled: req.body.enabled,
        env: req.body.env,
      });
      const result = await mcpSync.sync();
      return { ok: true, servers: getResolvedServers(req.params.id), written: result.written };
    },
  );

  // Remove override (revert to workspace default)
  app.delete<{ Params: { id: string; sid: string } }>(
    "/api/projects/:id/mcp/:sid",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      removeProjectMcpServer(req.params.id, req.params.sid);
      const result = await mcpSync.sync();
      return { ok: true, servers: getResolvedServers(req.params.id), written: result.written };
    },
  );

  // Force sync for this project
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/mcp/sync",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const result = await mcpSync.sync();
      return { ok: true, ...result };
    },
  );
}
