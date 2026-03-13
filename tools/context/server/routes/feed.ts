import crypto from "crypto";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import { insertFeedEvent, listFeedEvents } from "../db/index.js";

interface FeedEventInput {
  project_id: string;
  type: string;
  title: string;
  detail: Record<string, unknown>;
}

export function emitFeedEvent(mqtt: CtxMqttClient, input: FeedEventInput): void {
  const id = crypto.randomBytes(12).toString("hex");
  const row = {
    id,
    project_id: input.project_id,
    type: input.type,
    title: input.title,
    detail: JSON.stringify(input.detail),
  };

  insertFeedEvent(row);

  mqtt.publish(`ctx/projects/${input.project_id}/feed`, {
    ...row,
    detail: input.detail,
  });
}

export function registerFeedRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/feed",
    async (req) => {
      const query = req.query as { type?: string; limit?: string; offset?: string };
      return listFeedEvents({
        project_id: req.params.id,
        type: query.type,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
    },
  );
}
