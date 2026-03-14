import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nib, nibError } from "../util/nib.js";

export function registerScreenTools(server: McpServer): void {
  server.tool(
    "desktop_screenshot",
    "Capture a screenshot and return as base64 PNG. Optionally capture a specific region.",
    {
      region: z.string().optional().describe("Region as 'x,y,width,height' (omit for full screen)"),
      format: z.enum(["png", "jpg"]).default("png"),
    },
    async ({ region, format }) => {
      const args = ["screenshot-base64", "--format", format];
      if (region) args.push("--region", region);
      const r = await nib(args, 60_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      const b64 = typeof r.data === "string" ? r.data : (r.data as Record<string, string>)?.base64;
      if (!b64) {
        return { content: [{ type: "text", text: "Screenshot returned no image data" }], isError: true };
      }
      return {
        content: [{
          type: "image",
          data: b64,
          mimeType: format === "jpg" ? "image/jpeg" : "image/png",
        }],
      };
    },
  );

  server.tool(
    "desktop_screen_size",
    "Get screen dimensions in pixels.",
    {},
    async () => {
      const r = await nib(["screen-size"]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_color_at",
    "Get RGBA color at a screen position.",
    { x: z.number(), y: z.number() },
    async ({ x, y }) => {
      const r = await nib(["color-at", String(x), String(y)]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_highlight",
    "Highlight a screen region with an overlay (useful for debugging).",
    {
      x: z.number(), y: z.number(),
      width: z.number(), height: z.number(),
      duration: z.number().default(2000).describe("Duration in ms"),
      opacity: z.number().default(0.25).describe("Opacity 0-1"),
    },
    async ({ x, y, width, height, duration, opacity }) => {
      const r = await nib([
        "highlight", String(x), String(y), String(width), String(height),
        "--duration", String(duration), "--opacity", String(opacity),
      ]);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: `Highlighted region (${x},${y},${width},${height})` }] };
    },
  );

  server.tool(
    "desktop_find_text",
    "Find text on screen using OCR. Returns the region where text was found.",
    {
      text: z.string().describe("Text to find"),
      regex: z.boolean().default(false).describe("Treat text as regex pattern"),
      language: z.string().optional().describe("Comma-separated Tesseract language codes (e.g., 'eng,deu')"),
    },
    async ({ text, regex, language }) => {
      const args = ["find-text", text];
      if (regex) args.push("--regex");
      if (language) args.push("--language", language);
      const r = await nib(args, 60_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );

  server.tool(
    "desktop_read_text",
    "Read all text from screen or a specific region using OCR.",
    {
      region: z.string().optional().describe("Region as 'x,y,width,height' (omit for full screen)"),
      language: z.string().optional().describe("Comma-separated Tesseract language codes"),
      confidence: z.number().optional().describe("Minimum confidence threshold 0-100 (default 80)"),
    },
    async ({ region, language, confidence }) => {
      const args = ["read"];
      if (region) args.push("--region", region);
      if (language) args.push("--language", language);
      if (confidence !== undefined) args.push("--confidence", String(confidence));
      const r = await nib(args, 60_000);
      if (!r.ok) return { content: [{ type: "text", text: nibError(r) }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r.data) }] };
    },
  );
}
