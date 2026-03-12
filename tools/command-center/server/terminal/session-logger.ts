/**
 * Taps terminal session I/O → MQTT topics + JSONL log files.
 *
 * Each session gets a log at <root>/memory/sessions/<id>.jsonl with lines:
 *   { ts, type: "output"|"started"|"exited", data?, exitCode?, command?, cwd? }
 *
 * MQTT topics (real-time):
 *   ctx/session/<id>/output   — terminal output chunks
 *   ctx/session/<id>/started  — session metadata on spawn
 *   ctx/session/<id>/exited   — exit code
 */

import fs from "fs";
import path from "path";
import type { CtxMqttClient } from "ctx-mqtt";
import { TOPICS } from "ctx-mqtt/topics";
import type { SessionInfo, SocketPty } from "./manager.js";

let mqttClient: CtxMqttClient | null = null;
let logDir: string | null = null;

export function initSessionLogger(mqtt: CtxMqttClient, root: string): void {
  mqttClient = mqtt;
  logDir = path.join(root, "memory", "sessions");
  fs.mkdirSync(logDir, { recursive: true });
}

function appendLog(sessionId: string, entry: Record<string, unknown>): void {
  if (!logDir) return;
  const file = path.join(logDir, `${sessionId}.jsonl`);
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  fs.appendFileSync(file, line);
}

export function logSessionStarted(info: SessionInfo): void {
  const payload = {
    type: "started",
    command: info.command,
    cwd: info.cwd,
    startedAt: info.startedAt,
  };

  appendLog(info.id, payload);

  if (mqttClient?.connected()) {
    mqttClient.publish(TOPICS.session.started(info.id), JSON.stringify(payload));
  }
}

export function logSessionExited(sessionId: string, exitCode: number): void {
  const payload = { type: "exited", exitCode };

  appendLog(sessionId, payload);

  if (mqttClient?.connected()) {
    mqttClient.publish(TOPICS.session.exited(sessionId), JSON.stringify(payload));
  }
}

/**
 * Tap a SocketPty connection to stream output to MQTT and the log file.
 * Call this once per session (not per WebSocket client).
 */
export function tapSession(sessionId: string, pty: SocketPty): void {
  pty.onData((data) => {
    appendLog(sessionId, { type: "output", data });

    if (mqttClient?.connected()) {
      mqttClient.publish(TOPICS.session.output(sessionId), data);
    }
  });

  pty.onExit(({ exitCode }) => {
    logSessionExited(sessionId, exitCode);
  });
}
