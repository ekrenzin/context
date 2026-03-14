import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

export function registerSystemTools(server: McpServer): void {
  server.tool(
    "desktop_status",
    "Show system status and capabilities (platform, arch, available features).",
    {},
    async () => {
      const r = await nib(["status"]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_wait",
    "Wait for a specified duration in milliseconds.",
    { ms: z.number().describe("Duration in milliseconds") },
    async ({ ms }) => {
      const r = await nib(["wait", String(ms)], ms + 5000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Waited ${ms}ms` }] };
    },
  );

  server.tool(
    "desktop_list_keys",
    "List all available key names for use with desktop_press, desktop_key_down, desktop_key_up.",
    {},
    async () => {
      const r = await nib(["list-keys"]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );
}
