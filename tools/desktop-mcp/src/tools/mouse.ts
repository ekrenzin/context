import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

const buttonEnum = z.enum(["left", "right", "middle"]).default("left");
const directionEnum = z.enum(["up", "down", "left", "right"]);

export function registerMouseTools(server: McpServer): void {
  server.tool(
    "desktop_mouse_move",
    "Move mouse cursor to absolute coordinates.",
    { x: z.number(), y: z.number() },
    async ({ x, y }) => {
      const r = await nib(["mouse-move", String(x), String(y)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Moved to (${x}, ${y})` }] };
    },
  );

  server.tool(
    "desktop_mouse_move_smooth",
    "Move mouse cursor smoothly (human-like) to coordinates.",
    { x: z.number(), y: z.number() },
    async ({ x, y }) => {
      const r = await nib(["mouse-move-smooth", String(x), String(y)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Smoothly moved to (${x}, ${y})` }] };
    },
  );

  server.tool(
    "desktop_mouse_position",
    "Get current mouse cursor position.",
    {},
    async () => {
      const r = await nib(["mouse-position"]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_click",
    "Click at current position or specified coordinates.",
    {
      x: z.number().optional().describe("X coordinate (omit for current position)"),
      y: z.number().optional().describe("Y coordinate (omit for current position)"),
      button: buttonEnum.describe("Mouse button"),
    },
    async ({ x, y, button }) => {
      const args = ["click", "--button", button];
      if (x !== undefined) args.push("--x", String(x));
      if (y !== undefined) args.push("--y", String(y));
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_double_click",
    "Double-click at current position or specified coordinates.",
    {
      x: z.number().optional(),
      y: z.number().optional(),
      button: buttonEnum,
    },
    async ({ x, y, button }) => {
      const args = ["double-click", "--button", button];
      if (x !== undefined) args.push("--x", String(x));
      if (y !== undefined) args.push("--y", String(y));
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_right_click",
    "Right-click at current position or specified coordinates.",
    { x: z.number().optional(), y: z.number().optional() },
    async ({ x, y }) => {
      const args = ["right-click"];
      if (x !== undefined) args.push("--x", String(x));
      if (y !== undefined) args.push("--y", String(y));
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_drag",
    "Drag from one position to another.",
    {
      fromX: z.number(), fromY: z.number(),
      toX: z.number(), toY: z.number(),
    },
    async ({ fromX, fromY, toX, toY }) => {
      const r = await nib(["drag", String(fromX), String(fromY), String(toX), String(toY)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Dragged (${fromX},${fromY}) -> (${toX},${toY})` }] };
    },
  );

  server.tool(
    "desktop_scroll",
    "Scroll in a direction.",
    {
      direction: directionEnum,
      amount: z.number().default(3).describe("Scroll amount (default 3)"),
    },
    async ({ direction, amount }) => {
      const r = await nib(["scroll", direction, String(amount)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Scrolled ${direction} by ${amount}` }] };
    },
  );
}
