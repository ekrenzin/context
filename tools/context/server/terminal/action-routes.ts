/**
 * Terminal action routes and MQTT bridge.
 *
 * Actions are terminal sessions that require user attention. They can be
 * created via REST or MQTT and are tracked with metadata (title, description).
 *
 * MQTT topics:
 *   ctx/terminal/action/request  -- subscribe: triggers action creation
 *   ctx/terminal/action          -- publish: notifies UI of new action
 *   ctx/terminal/action/<id>/completed -- publish: user marked action done
 *
 * REST endpoints:
 *   POST   /api/terminal/action          -- create an action
 *   GET    /api/terminal/actions          -- list pending actions
 *   PATCH  /api/terminal/action/:id/complete -- mark action completed
 */

import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import { TOPICS } from "ctx-mqtt/topics";
import { spawnSession, connectSession, registerTap } from "./manager.js";
import { logSessionStarted, tapSession } from "./session-logger.js";
import {
  createAction,
  completeAction,
  listPendingActions,
  type CreateActionInput,
  type Action,
} from "./action-store.js";

let mqtt: CtxMqttClient | null = null;

async function spawnActionSession(input: CreateActionInput): Promise<Action> {
  const session = await spawnSession({
    command: input.command,
    args: input.args,
    cwd: input.cwd,
  });
  logSessionStarted(session);

  const tap = await connectSession(session.id);
  if (tap) {
    registerTap(session.id, tap);
    tapSession(session.id, tap);
  }

  const action = createAction(input, session.id);

  if (mqtt) {
    mqtt.publish(TOPICS.action.created, JSON.stringify(action));
  }

  console.log(`[action] created ${action.id} -> session ${session.id}`);
  return action;
}

export function registerActionRoutes(app: FastifyInstance): void {
  app.post<{ Body: CreateActionInput }>(
    "/api/terminal/action",
    async (req, reply) => {
      const { command, title } = req.body ?? {};
      if (!command || !title) {
        return reply.code(400).send({ error: "command and title are required" });
      }
      const action = await spawnActionSession(req.body);
      return { id: action.id, sessionId: action.sessionId };
    },
  );

  app.get("/api/terminal/actions", async () => listPendingActions());

  app.patch<{ Params: { id: string } }>(
    "/api/terminal/action/:id/complete",
    async (req, reply) => {
      const action = completeAction(req.params.id);
      if (!action) {
        return reply.code(404).send({ error: "Action not found or already completed" });
      }

      if (mqtt) {
        mqtt.publish(
          TOPICS.action.completed(action.id),
          JSON.stringify(action),
        );
      }

      console.log(`[action] completed ${action.id}`);
      return { ok: true, action };
    },
  );
}

export function initActionBridge(mqttClient: CtxMqttClient): void {
  mqtt = mqttClient;

  mqttClient.subscribe(TOPICS.action.request, async (_topic, buf) => {
    try {
      const input = JSON.parse(buf.toString()) as CreateActionInput;
      if (!input.command || !input.title) {
        console.warn("[action-bridge] ignoring request: missing command or title");
        return;
      }
      await spawnActionSession(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[action-bridge] failed to create action: ${msg}`);
    }
  });

  console.log("[action-bridge] terminal action MQTT bridge active");
}
