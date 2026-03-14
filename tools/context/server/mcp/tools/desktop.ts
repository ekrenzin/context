import { z } from "zod";
import { execFile } from "child_process";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";

const TIMEOUT = 30_000;

function nibBin(root: string): string {
  return path.resolve(root, "tools/desktop-mcp/node_modules/.bin/nib");
}

function runNib(
  bin: string,
  args: string[],
  timeout = TIMEOUT,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout }, (err, stdout, stderr) => {
      if (err && !stdout) {
        resolve({ ok: false, error: err.message + "\n" + stderr });
        return;
      }
      try {
        const r = JSON.parse(stdout.trim());
        if (!r.ok) {
          resolve({ ok: false, error: r.error?.message ?? "nib error" });
        } else {
          resolve({ ok: true, data: r.data });
        }
      } catch {
        resolve({ ok: false, error: "Non-JSON output: " + stdout });
      }
    });
  });
}

function result(r: { ok: boolean; data?: unknown; error?: string }) {
  if (!r.ok) {
    return { content: [{ type: "text" as const, text: r.error ?? "Unknown error" }], isError: true };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(r.data, null, 2) }] };
}

const windowOpts = {
  window: z.string().optional().describe("Window title (case-insensitive)"),
  app: z.string().optional().describe("Application name"),
};

function wArgs(opts: { window?: string; app?: string }): string[] {
  const a: string[] = [];
  if (opts.window) a.push("--window", opts.window);
  if (opts.app) a.push("--app", opts.app);
  return a;
}

export function register(server: McpServer, deps: McpDeps): void {
  const bin = nibBin(deps.root);

  // ── Mouse ─────────────────────────────────────────────────────

  server.tool(
    "cc_desktop_click",
    "Click at coordinates or current position.",
    {
      x: z.number().optional(), y: z.number().optional(),
      button: z.enum(["left", "right", "middle"]).default("left"),
    },
    async ({ x, y, button }) => {
      const args = ["click", "--button", button];
      if (x !== undefined) args.push("--x", String(x));
      if (y !== undefined) args.push("--y", String(y));
      return result(await runNib(bin, args));
    },
  );

  server.tool(
    "cc_desktop_mouse_move",
    "Move mouse cursor to coordinates.",
    { x: z.number(), y: z.number(), smooth: z.boolean().default(true) },
    async ({ x, y, smooth }) => {
      const cmd = smooth ? "mouse-move-smooth" : "mouse-move";
      return result(await runNib(bin, [cmd, String(x), String(y)]));
    },
  );

  server.tool(
    "cc_desktop_scroll",
    "Scroll in a direction.",
    { direction: z.enum(["up", "down", "left", "right"]), amount: z.number().default(3) },
    async ({ direction, amount }) => result(await runNib(bin, ["scroll", direction, String(amount)])),
  );

  server.tool(
    "cc_desktop_drag",
    "Drag from one point to another.",
    { fromX: z.number(), fromY: z.number(), toX: z.number(), toY: z.number() },
    async ({ fromX, fromY, toX, toY }) =>
      result(await runNib(bin, ["drag", String(fromX), String(fromY), String(toX), String(toY)])),
  );

  // ── Keyboard ──────────────────────────────────────────────────

  server.tool(
    "cc_desktop_type",
    "Type text via keyboard.",
    { text: z.string() },
    async ({ text }) => result(await runNib(bin, ["type", text])),
  );

  server.tool(
    "cc_desktop_press",
    "Press a key combination (e.g., 'LeftCmd C' for Cmd+C, 'Enter').",
    { keys: z.string().describe("Space-separated key names") },
    async ({ keys }) => result(await runNib(bin, ["press", ...keys.split(/\s+/)])),
  );

  // ── Screen ────────────────────────────────────────────────────

  server.tool(
    "cc_desktop_screenshot",
    "Capture a screenshot as base64 PNG. Returns image data.",
    { region: z.string().optional().describe("Region as 'x,y,width,height'") },
    async ({ region }) => {
      const args = ["screenshot-base64", "--format", "png"];
      if (region) args.push("--region", region);
      const r = await runNib(bin, args, 60_000);
      if (!r.ok) return { content: [{ type: "text" as const, text: r.error ?? "Screenshot failed" }], isError: true };
      let b64 = typeof r.data === "string" ? r.data : (r.data as Record<string, string>)?.base64;
      if (!b64) return { content: [{ type: "text" as const, text: "No image data returned" }], isError: true };
      const commaIdx = b64.indexOf(",");
      if (commaIdx !== -1 && b64.startsWith("data:")) b64 = b64.slice(commaIdx + 1);
      return { content: [{ type: "image" as const, data: b64, mimeType: "image/png" }] };
    },
  );

  server.tool(
    "cc_desktop_screen_size",
    "Get screen dimensions.",
    {},
    async () => result(await runNib(bin, ["screen-size"])),
  );

  server.tool(
    "cc_desktop_read_text",
    "Read text from screen or a region using OCR.",
    {
      region: z.string().optional().describe("Region as 'x,y,width,height'"),
      confidence: z.number().optional().describe("Min confidence 0-100 (default 80)"),
    },
    async ({ region, confidence }) => {
      const args = ["read"];
      if (region) args.push("--region", region);
      if (confidence !== undefined) args.push("--confidence", String(confidence));
      return result(await runNib(bin, args, 60_000));
    },
  );

  server.tool(
    "cc_desktop_find_text",
    "Find text on screen using OCR. Returns the region where text was found.",
    { text: z.string(), regex: z.boolean().default(false) },
    async ({ text, regex }) => {
      const args = ["find-text", text];
      if (regex) args.push("--regex");
      return result(await runNib(bin, args, 60_000));
    },
  );

  // ── Windows ───────────────────────────────────────────────────

  server.tool(
    "cc_desktop_list_windows",
    "List all open windows.",
    { app: z.string().optional().describe("Filter by application name") },
    async ({ app }) => {
      const args = ["list-windows", "--full"];
      if (app) args.push("--app", app);
      return result(await runNib(bin, args));
    },
  );

  server.tool(
    "cc_desktop_focus_window",
    "Focus a window by title or app name.",
    windowOpts,
    async (opts) => result(await runNib(bin, ["focus-window", ...wArgs(opts)])),
  );

  server.tool(
    "cc_desktop_active_window",
    "Get info about the currently active window.",
    {},
    async () => result(await runNib(bin, ["active-window", "--full"])),
  );

  // ── Clipboard ─────────────────────────────────────────────────

  server.tool(
    "cc_desktop_clipboard_get",
    "Get clipboard text content.",
    {},
    async () => result(await runNib(bin, ["clipboard-get"])),
  );

  server.tool(
    "cc_desktop_clipboard_set",
    "Set clipboard text content.",
    { text: z.string() },
    async ({ text }) => result(await runNib(bin, ["clipboard-set", text])),
  );

  // ── Accessibility / Elements ──────────────────────────────────

  server.tool(
    "cc_desktop_snapshot",
    "Snapshot a window's accessibility tree. Returns semantic element refs like @btn:Save. Always call before using element refs.",
    { ...windowOpts, interactive: z.boolean().default(true) },
    async ({ interactive, ...opts }) => {
      const args = ["snapshot", ...wArgs(opts)];
      if (interactive) args.push("-i");
      return result(await runNib(bin, args));
    },
  );

  server.tool(
    "cc_desktop_diff",
    "Diff current accessibility tree against last snapshot. Shows what changed after an action.",
    windowOpts,
    async (opts) => result(await runNib(bin, ["diff", ...wArgs(opts)])),
  );

  server.tool(
    "cc_desktop_click_element",
    "Click an element by ref (e.g., @btn:Save). Requires prior snapshot.",
    { ref: z.string().describe("Element ref"), ...windowOpts },
    async ({ ref, ...opts }) => result(await runNib(bin, ["click-element", ref, ...wArgs(opts)])),
  );

  server.tool(
    "cc_desktop_type_element",
    "Click on an element and type text into it.",
    { ref: z.string(), text: z.string(), ...windowOpts },
    async ({ ref, text, ...opts }) => result(await runNib(bin, ["type-element", ref, text, ...wArgs(opts)])),
  );

  server.tool(
    "cc_desktop_check_element",
    "Check an element's state (enabled, checked, focused, visible, etc.).",
    {
      ref: z.string(), ...windowOpts,
      property: z.enum(["visible", "enabled", "checked", "focused", "selected", "expanded"]),
    },
    async ({ ref, property, ...opts }) =>
      result(await runNib(bin, ["check-element", ref, ...wArgs(opts), "--property", property])),
  );

  // ── Utility ───────────────────────────────────────────────────

  server.tool(
    "cc_desktop_wait",
    "Wait for a duration in milliseconds.",
    { ms: z.number() },
    async ({ ms }) => result(await runNib(bin, ["wait", String(ms)], ms + 5000)),
  );

  server.tool(
    "cc_desktop_wait_for_window",
    "Wait for a window to appear.",
    { ...windowOpts, timeout: z.number().default(10000) },
    async ({ timeout, ...opts }) =>
      result(await runNib(bin, ["wait-for-window", ...wArgs(opts), "--timeout", String(timeout)], timeout + 5000)),
  );
}
