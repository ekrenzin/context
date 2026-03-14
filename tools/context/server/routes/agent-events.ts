import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";

interface EmitBody {
  tool: string;
  event: string;
  data?: Record<string, unknown>;
}

export function registerAgentEventRoutes(
  app: FastifyInstance,
  mqttClient: CtxMqttClient,
): void {
  app.post<{ Body: EmitBody }>("/api/agent/emit", async (req, reply) => {
    const { tool, event, data } = req.body ?? {};

    if (!tool || !event) {
      reply.code(400).send({ error: "tool and event are required" });
      return;
    }

    if (!/^[a-z0-9-]+$/.test(tool)) {
      reply.code(400).send({ error: "tool must be lowercase alphanumeric with dashes" });
      return;
    }

    if (!/^[a-z0-9-/]+$/.test(event)) {
      reply.code(400).send({ error: "event must be lowercase alphanumeric with dashes and slashes" });
      return;
    }

    const topic = `ctx/agent/${tool}/${event}`;
    const payload = {
      tool,
      ts: new Date().toISOString(),
      ...data,
    };

    mqttClient.publish(topic, payload);

    reply.send({ ok: true, topic });
  });
}
