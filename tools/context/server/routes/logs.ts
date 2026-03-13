import type { FastifyInstance } from "fastify";
import type { LogEntry } from "../types.js";
import { topicFor, type CtxMqttClient } from "ctx-mqtt";

const MAX_BUFFER = 500;
const buffer: LogEntry[] = [];

const LEVEL_NAMES: Record<number, string> = {
  10: "debug",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "error",
};

function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? (level >= 50 ? "error" : "info");
}

function pushEntry(entry: LogEntry, mqttClient: CtxMqttClient): void {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) {
    buffer.splice(0, buffer.length - MAX_BUFFER);
  }
  mqttClient.publish(topicFor(`logs/${levelName(entry.level)}`), entry);
}

export function registerLogRoutes(
  app: FastifyInstance,
  mqttClient: CtxMqttClient,
): void {
  app.post<{ Body: LogEntry | LogEntry[] }>(
    "/api/logs",
    async (req, reply) => {
      const body = req.body;
      const entries = Array.isArray(body) ? body : [body];

      for (const entry of entries) {
        if (typeof entry.msg !== "string" || typeof entry.level !== "number") {
          return reply.code(400).send({ error: "Invalid log entry" });
        }
        pushEntry(entry, mqttClient);
      }

      return reply.code(202).send({ accepted: entries.length });
    },
  );

  app.get<{
    Querystring: {
      name?: string;
      minLevel?: string;
      limit?: string;
    };
  }>("/api/logs", async (req) => {
    const { name, minLevel, limit } = req.query;
    let entries = buffer;

    if (name) {
      entries = entries.filter((e) => e.name === name);
    }
    if (minLevel) {
      const lvl = parseInt(minLevel, 10);
      if (!isNaN(lvl)) {
        entries = entries.filter((e) => e.level >= lvl);
      }
    }

    const max = Math.min(parseInt(limit ?? "200", 10) || 200, MAX_BUFFER);
    return { entries: entries.slice(-max), total: entries.length };
  });
}
