import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

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

const windowTarget = {
  window: z.string().optional().describe("Window title (case-insensitive match)"),
  app: z.string().optional().describe("Application name"),
  pid: z.number().optional().describe("Process ID"),
  bundleId: z.string().optional().describe("Bundle identifier (macOS)"),
};

export function registerWindowTools(server: McpServer): void {
  server.tool(
    "desktop_list_windows",
    "List all open windows. Use --full for owner details.",
    {
      full: z.boolean().default(false).describe("Include owner details and window state"),
      app: z.string().optional().describe("Filter by application name"),
    },
    async ({ full, app }) => {
      const args = ["list-windows"];
      if (full) args.push("--full");
      if (app) args.push("--app", app);
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_active_window",
    "Get information about the currently active window.",
    { full: z.boolean().default(false) },
    async ({ full }) => {
      const args = ["active-window"];
      if (full) args.push("--full");
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data, null, 2) }] };
    },
  );

  server.tool(
    "desktop_focus_window",
    "Focus a window by title, app name, PID, or bundle ID.",
    windowTarget,
    async (opts) => {
      const args = ["focus-window", ...windowArgs(opts)];
      if (opts.window && !windowArgs(opts).includes("--window")) {
        args.push(opts.window);
      }
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_window_region",
    "Get position and size of a window.",
    windowTarget,
    async (opts) => {
      const args = ["window-region", ...windowArgs(opts)];
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_resize_window",
    "Resize a window.",
    { ...windowTarget, width: z.number(), height: z.number() },
    async ({ width, height, ...opts }) => {
      const args = ["resize-window", ...windowArgs(opts), String(width), String(height)];
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Resized to ${width}x${height}` }] };
    },
  );

  server.tool(
    "desktop_move_window",
    "Move a window to a new position.",
    { ...windowTarget, x: z.number(), y: z.number() },
    async ({ x, y, ...opts }) => {
      const args = ["move-window", ...windowArgs(opts), String(x), String(y)];
      const r = await nib(args);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Moved to (${x}, ${y})` }] };
    },
  );

  server.tool(
    "desktop_minimize_window",
    "Minimize a window.",
    windowTarget,
    async (opts) => {
      const r = await nib(["minimize-window", ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: "Window minimized" }] };
    },
  );

  server.tool(
    "desktop_restore_window",
    "Restore a minimized window.",
    windowTarget,
    async (opts) => {
      const r = await nib(["restore-window", ...windowArgs(opts)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: "Window restored" }] };
    },
  );

  server.tool(
    "desktop_wait_for_window",
    "Wait for a window to appear.",
    {
      ...windowTarget,
      timeout: z.number().default(10000).describe("Timeout in ms"),
      interval: z.number().default(500).describe("Poll interval in ms"),
    },
    async ({ timeout, interval, ...opts }) => {
      const args = [
        "wait-for-window", ...windowArgs(opts),
        "--timeout", String(timeout), "--interval", String(interval),
      ];
      const r = await nib(args, timeout + 5000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );
}
