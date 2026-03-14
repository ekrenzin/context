import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

export function registerKeyboardTools(server: McpServer): void {
  server.tool(
    "desktop_type",
    "Type text via keyboard.",
    { text: z.string().describe("Text to type") },
    async ({ text }) => {
      const r = await nib(["type", text]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Typed: ${text}` }] };
    },
  );

  server.tool(
    "desktop_press",
    "Press a key combination (e.g., 'LeftCmd C' for Cmd+C). Use 'nib list-keys' naming.",
    { keys: z.string().describe("Space-separated key names (e.g., 'LeftCmd C', 'Enter', 'LeftAlt Tab')") },
    async ({ keys }) => {
      const r = await nib(["press", ...keys.split(/\s+/)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Pressed: ${keys}` }] };
    },
  );

  server.tool(
    "desktop_key_down",
    "Press and hold keys (release with desktop_key_up).",
    { keys: z.string().describe("Space-separated key names to hold") },
    async ({ keys }) => {
      const r = await nib(["key-down", ...keys.split(/\s+/)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Holding: ${keys}` }] };
    },
  );

  server.tool(
    "desktop_key_up",
    "Release held keys.",
    { keys: z.string().describe("Space-separated key names to release") },
    async ({ keys }) => {
      const r = await nib(["key-up", ...keys.split(/\s+/)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Released: ${keys}` }] };
    },
  );
}
