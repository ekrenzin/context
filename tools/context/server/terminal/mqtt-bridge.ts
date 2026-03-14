/**
 * MQTT bridge for headless terminal control.
 *
 * Subscribes to:
 *   ctx/session/spawn          — create a new session
 *   ctx/session/+/input        — write stdin to a session
 *   ctx/session/+/kill         — terminate a session
 *
 * This lets any MQTT client drive terminal sessions without the web UI.
 */

import type { CtxMqttClient } from "ctx-mqtt";
import { TOPICS } from "ctx-mqtt/topics";
import {
  spawnSession,
  connectSession,
  killSession,
  setSessionState,
  registerTap,
} from "./manager.js";
import { logSessionStarted, tapSession } from "./session-logger.js";

const INPUT_PATTERN = "ctx/session/+/input";
const KILL_PATTERN = "ctx/session/+/kill";
const STATE_PATTERN = "ctx/session/+/state";

function extractSessionId(topic: string): string {
  // ctx/session/<id>/input or ctx/session/<id>/kill
  return topic.split("/")[2];
}

/** Connected PTY handles kept alive for input forwarding. */
const inputPtys = new Map<string, { write: (data: string) => void }>();

export function initTerminalBridge(mqtt: CtxMqttClient): void {
  mqtt.subscribe(TOPICS.session.spawn, async (_topic, buf) => {
    try {
      const opts = JSON.parse(buf.toString());
      const session = await spawnSession(opts);
      logSessionStarted(session);

      const tap = await connectSession(session.id);
      if (tap) {
        registerTap(session.id, tap);
        tapSession(session.id, tap);
      }

      mqtt.publish(
        TOPICS.session.started(session.id),
        JSON.stringify(session),
      );
      console.log(`[mqtt-bridge] spawned session ${session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[mqtt-bridge] spawn failed: ${msg}`);
    }
  });

  mqtt.subscribe(INPUT_PATTERN, async (topic, buf) => {
    const id = extractSessionId(topic);
    const data = buf.toString();

    if (!inputPtys.has(id)) {
      const pty = await connectSession(id);
      if (!pty) {
        console.warn(`[mqtt-bridge] input for unknown session ${id}`);
        return;
      }
      inputPtys.set(id, pty);
      pty.onExit(() => inputPtys.delete(id));
    }

    inputPtys.get(id)!.write(data);
  });

  mqtt.subscribe(KILL_PATTERN, (_topic, buf) => {
    const id = extractSessionId(_topic);
    const ok = killSession(id);
    inputPtys.delete(id);
    console.log(`[mqtt-bridge] kill ${id}: ${ok ? "done" : "not found"}`);
  });

  mqtt.subscribe(STATE_PATTERN, (_topic, buf) => {
    const id = extractSessionId(_topic);
    try {
      const { state } = JSON.parse(buf.toString());
      const ok = setSessionState(id, state);
      if (!ok) console.warn(`[mqtt-bridge] invalid state for ${id}: ${state}`);
    } catch {
      console.warn(`[mqtt-bridge] bad state payload for ${id}`);
    }
  });

  console.log("[mqtt-bridge] terminal MQTT bridge active");
}
