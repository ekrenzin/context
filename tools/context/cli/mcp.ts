import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiGet, apiPost } from "./client.js";

const TOOLS = [
  {
    name: "memory_scan",
    description: "Search agent memory for relevant entries",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search keywords" },
        type: { type: "string", description: "Memory type filter" },
        repo: { type: "string", description: "Repository filter" },
      },
    },
  },
  {
    name: "memory_write",
    description: "Write a new memory entry",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Memory type" },
        title: { type: "string", description: "Entry title" },
        content: { type: "string", description: "Entry content" },
        repo: { type: "string", description: "Related repository" },
        ticket: { type: "string", description: "Related ticket" },
      },
      required: ["type", "title", "content"],
    },
  },
  {
    name: "workspace_sync",
    description: "Sync canonical workspace to IDE-specific formats",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "profiler_status",
    description: "Get profiler scan status and recent sessions",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "session_history",
    description: "Get recent session analysis history",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results" },
      },
    },
  },
];

async function handleTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "memory_scan": {
      const params = new URLSearchParams();
      if (args.query) params.set("query", String(args.query));
      if (args.type) params.set("type", String(args.type));
      if (args.repo) params.set("repo", String(args.repo));
      const data = await apiGet(`/api/memory?${params}`);
      return JSON.stringify(data, null, 2);
    }

    case "memory_write": {
      const data = await apiPost("/api/memory", args);
      return JSON.stringify(data, null, 2);
    }

    case "workspace_sync": {
      const data = await apiPost("/api/workspace/sync");
      return JSON.stringify(data, null, 2);
    }

    case "profiler_status": {
      const data = await apiGet("/api/profiler/status");
      return JSON.stringify(data, null, 2);
    }

    case "session_history": {
      const limit = Number(args.limit) || 10;
      const data = await apiGet(`/api/sessions?limit=${limit}`);
      return JSON.stringify(data, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function serveMcp(): Promise<void> {
  const server = new Server({ name: "context", version: "1.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const text = await handleTool(name, (args ?? {}) as Record<string, unknown>);
    return { content: [{ type: "text", text }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
