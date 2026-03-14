#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMouseTools } from "./tools/mouse.js";
import { registerKeyboardTools } from "./tools/keyboard.js";
import { registerScreenTools } from "./tools/screen.js";
import { registerWindowTools } from "./tools/window.js";
import { registerClipboardTools } from "./tools/clipboard.js";
import { registerElementTools } from "./tools/element.js";
import { registerSystemTools } from "./tools/system.js";

const server = new McpServer({
  name: "desktop-mcp",
  version: "0.1.0",
});

registerMouseTools(server);
registerKeyboardTools(server);
registerScreenTools(server);
registerWindowTools(server);
registerClipboardTools(server);
registerElementTools(server);
registerSystemTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[desktop-mcp] server started on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
