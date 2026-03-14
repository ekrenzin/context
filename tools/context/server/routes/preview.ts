import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";

interface PreviewEntry {
  id: string;
  path: string;
  filename: string;
  type: string;
  title: string;
  url: string;
  timestamp: string;
}

const entries: PreviewEntry[] = [];

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".html": "text/html", ".htm": "text/html",
  ".csv": "text/csv", ".json": "application/json", ".md": "text/plain",
};

export function registerPreviewRoutes(
  app: FastifyInstance,
  mqttClient: CtxMqttClient,
): void {
  // Collect entries from MQTT
  mqttClient.subscribe("ctx/preview/opened", (_topic: string, payload: Buffer) => {
    try {
      const entry = JSON.parse(payload.toString()) as PreviewEntry;
      if (entry?.id && !entries.find((e) => e.id === entry.id)) {
        entries.push(entry);
      }
    } catch { /* ignore malformed messages */ }
  });

  // Serve preview files
  app.get("/api/preview/files/:id/:filename", (req, reply) => {
    const { id } = req.params as { id: string; filename: string };
    const entry = entries.find((e) => e.id === id);
    if (!entry || !fs.existsSync(entry.path)) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const ext = path.extname(entry.path).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    reply.header("Content-Type", mime);
    reply.send(fs.createReadStream(entry.path));
  });

  // SSE endpoint for live preview events
  app.get("/api/preview/events", (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send existing entries
    for (const entry of entries) {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    // Stream new entries
    const handler = (_topic: string, payload: Buffer) => {
      try {
        const entry = JSON.parse(payload.toString()) as PreviewEntry;
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch { /* ignore */ }
    };

    mqttClient.subscribe("ctx/preview/opened", handler);
    req.raw.on("close", () => {
      // CtxMqttClient has no unsubscribe -- subscriptions last for client lifetime
    });
  });

  // List all entries
  app.get("/api/preview/entries", (_req, reply) => {
    reply.send(entries);
  });
}
