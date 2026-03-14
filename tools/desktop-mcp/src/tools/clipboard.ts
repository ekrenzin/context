import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

export function registerClipboardTools(server: McpServer): void {
  server.tool(
    "desktop_clipboard_get",
    "Get current clipboard text content.",
    {},
    async () => {
      const r = await nib(["clipboard-get"]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_clipboard_set",
    "Set clipboard text content.",
    { text: z.string().describe("Text to copy to clipboard") },
    async ({ text }) => {
      const r = await nib(["clipboard-set", text]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: "Clipboard set" }] };
    },
  );
}
