import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerMemoryResources } from "./resources/memory.js";

const server = new McpServer({
  name: "context-workspace",
  version: "0.1.0",
});

registerKnowledgeTools(server);
registerMemoryTools(server);
registerMemoryResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
