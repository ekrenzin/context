#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerMqttTools } from "./tools/mqtt.js";
import { registerSecurityTools } from "./tools/security.js";

const server = new McpServer({
  name: "context-workspace",
  version: "0.1.0",
});

registerMemoryTools(server);
registerKnowledgeTools(server);
registerWorkspaceTools(server);
registerMqttTools(server);
registerSecurityTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
