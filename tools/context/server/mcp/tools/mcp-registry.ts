import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpDeps } from "../index.js";
import { searchRegistry } from "../../mcp-sync/registry.js";
import {
  listMcpServers,
  upsertMcpServer,
  toggleMcpServer,
} from "../../db/queries/mcp-servers.js";
import { generateConfigs } from "../../mcp-sync/generate.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_mcp_search",
    "Search the official MCP Registry for available servers.",
    {
      query: z.string().optional().describe("Search term"),
      namespace: z.string().optional().describe("Filter by namespace (e.g. com.amazonaws)"),
    },
    async ({ query, namespace }) => {
      const result = await searchRegistry(query);
      if (result.error) {
        return { content: [{ type: "text" as const, text: `Error: ${result.error}` }] };
      }
      if (result.servers.length === 0) {
        return { content: [{ type: "text" as const, text: "No servers found." }] };
      }
      const lines = result.servers.map(
        (s) => `${s.name} -- ${s.description ?? "No description"}`,
      );
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_mcp_list",
    "List all installed MCP servers and their status.",
    {},
    async () => {
      const servers = listMcpServers();
      if (servers.length === 0) {
        return { content: [{ type: "text" as const, text: "No MCP servers installed." }] };
      }
      const lines = servers.map(
        (s) =>
          `${s.name} [${s.enabled ? "enabled" : "disabled"}] (${s.command} ${JSON.parse(s.args).join(" ")})`,
      );
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_mcp_install",
    "Install an MCP server by providing its details.",
    {
      id: z.string().describe("Server identifier"),
      name: z.string().describe("Display name"),
      namespace: z.string().default("unknown"),
      command: z.string().describe("Command to run (uvx, npx, etc.)"),
      args: z.array(z.string()).default([]),
      env: z.record(z.string(), z.string()).default({}),
    },
    async ({ id, name, namespace, command, args, env }) => {
      upsertMcpServer({ id, name, namespace, command, args, env });
      const { written } = generateConfigs(root);
      return {
        content: [
          {
            type: "text" as const,
            text: `Installed ${name}. Updated: ${written.join(", ") || "no changes"}`,
          },
        ],
      };
    },
  );

  server.tool(
    "cc_mcp_toggle",
    "Enable or disable an installed MCP server.",
    {
      id: z.string().describe("Server identifier"),
      enabled: z.boolean().describe("true to enable, false to disable"),
    },
    async ({ id, enabled }) => {
      toggleMcpServer(id, enabled);
      const { written } = generateConfigs(root);
      const state = enabled ? "enabled" : "disabled";
      return {
        content: [
          {
            type: "text" as const,
            text: `Server ${id} ${state}. Updated: ${written.join(", ") || "no changes"}`,
          },
        ],
      };
    },
  );
}
