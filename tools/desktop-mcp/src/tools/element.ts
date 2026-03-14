import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

const windowTarget = {
  window: z.string().optional().describe("Window title (case-insensitive)"),
  app: z.string().optional().describe("Application name"),
  pid: z.number().optional().describe("Process ID"),
  bundleId: z.string().optional().describe("Bundle identifier (macOS)"),
};

function windowArgs(opts: {
  window?: string; app?: string; pid?: number; bundleId?: string;
}): string[] {
  const args: string[] = [];
  if (opts.window) args.push("--window", opts.window);
  if (opts.app) args.push("--app", opts.app);
  if (opts.pid !== undefined) args.push("--pid", String(opts.pid));
  if (opts.bundleId) args.push("--bundle-id", opts.bundleId);
  return args;
}

export function registerElementTools(server: McpServer): void {
  server.tool(
    "desktop_snapshot",
    "Capture the accessibility tree of a window. Returns semantic element refs like @btn:Save, @txt:Username. Always call this before using element refs.",
    {
      ...windowTarget,
      interactive: z.boolean().default(true).describe("Only show interactive elements"),
      tree: z.boolean().default(false).describe("Show full nested tree instead of flat ref list"),
      compact: z.boolean().default(false).describe("Compact output"),
      max: z.number().optional().describe("Max elements to return"),
    },
    async ({ interactive, tree, compact, max, ...opts }) => {
      const args = ["snapshot", ...windowArgs(opts)];
      if (interactive) args.push("-i");
      if (tree) args.push("--tree");
      if (compact) args.push("--compact");
      if (max !== undefined) args.push("--max", String(max));
      const r = await nib(args, 30_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_diff",
    "Compare current accessibility tree against last snapshot. Shows added, removed, and changed elements. Updates stored snapshot.",
    windowTarget,
    async (opts) => {
      const r = await nib(["diff", ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_click_element",
    "Click an element by its ref (e.g., @btn:Save). Requires a prior snapshot.",
    { ref: z.string().describe("Element ref (e.g., @btn:Save)"), ...windowTarget },
    async ({ ref, ...opts }) => {
      const r = await nib(["click-element", ref, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_double_click_element",
    "Double-click an element by ref.",
    { ref: z.string(), ...windowTarget },
    async ({ ref, ...opts }) => {
      const r = await nib(["double-click-element", ref, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_right_click_element",
    "Right-click an element by ref.",
    { ref: z.string(), ...windowTarget },
    async ({ ref, ...opts }) => {
      const r = await nib(["right-click-element", ref, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_type_element",
    "Click on an element and type text into it.",
    { ref: z.string(), text: z.string(), ...windowTarget },
    async ({ ref, text, ...opts }) => {
      const r = await nib(["type-element", ref, text, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Typed "${text}" into ${ref}` }] };
    },
  );

  server.tool(
    "desktop_focus_element",
    "Focus an element by ref.",
    { ref: z.string(), ...windowTarget },
    async ({ ref, ...opts }) => {
      const r = await nib(["focus-element", ref, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Focused ${ref}` }] };
    },
  );

  server.tool(
    "desktop_hover_element",
    "Hover over an element by ref.",
    { ref: z.string(), ...windowTarget },
    async ({ ref, ...opts }) => {
      const r = await nib(["hover-element", ref, ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Hovered ${ref}` }] };
    },
  );

  server.tool(
    "desktop_scroll_element",
    "Scroll at an element's position.",
    {
      ref: z.string(),
      direction: z.enum(["up", "down", "left", "right"]),
      amount: z.number().default(3),
      ...windowTarget,
    },
    async ({ ref, direction, amount, ...opts }) => {
      const r = await nib(["scroll-element", ref, direction, String(amount), ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Scrolled ${direction} at ${ref}` }] };
    },
  );

  server.tool(
    "desktop_find_element",
    "Find elements matching criteria in a window.",
    {
      ...windowTarget,
      type: z.string().optional().describe("Element type (e.g., button, textfield)"),
      title: z.string().optional().describe("Title pattern"),
      role: z.string().optional().describe("Accessibility role"),
      id: z.string().optional().describe("Element ID"),
      helpText: z.string().optional().describe("Tooltip / help text pattern"),
      className: z.string().optional().describe("UI class name pattern"),
    },
    async ({ type, title, role, id, helpText, className, ...opts }) => {
      const args = ["find-element", ...windowArgs(opts)];
      if (type) args.push("--type", type);
      if (title) args.push("--title", title);
      if (role) args.push("--role", role);
      if (id) args.push("--id", id);
      if (helpText) args.push("--help-text", helpText);
      if (className) args.push("--class-name", className);
      const r = await nib(args, 30_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_get_element",
    "Get properties of an element by ref (live query).",
    {
      ref: z.string(),
      ...windowTarget,
      property: z.enum(["title", "value", "role", "type", "region", "states", "all"]).default("all"),
    },
    async ({ ref, property, ...opts }) => {
      const r = await nib(["get-element", ref, ...windowArgs(opts), "--property", property]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_check_element",
    "Check an element's state (live query). Returns boolean for the requested property.",
    {
      ref: z.string(),
      ...windowTarget,
      property: z.enum(["visible", "enabled", "checked", "focused", "selected", "expanded", "readonly", "required"]),
    },
    async ({ ref, property, ...opts }) => {
      const r = await nib(["check-element", ref, ...windowArgs(opts), "--property", property]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_window_elements",
    "Get the raw UI element tree of a window.",
    {
      ...windowTarget,
      max: z.number().optional().describe("Max elements to return"),
    },
    async ({ max, ...opts }) => {
      const args = ["window-elements", ...windowArgs(opts)];
      if (max !== undefined) args.push("--max", String(max));
      const r = await nib(args, 30_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );
}
