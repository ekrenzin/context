/**
 * Taps terminal session I/O -> MQTT topics + JSONL log files.
 *
 * Each session gets a log at <root>/memory/sessions/<id>.jsonl with lines:
 *   { ts, type: "output"|"started"|"exited", data?, exitCode?, command?, cwd? }
 *
 * A sidecar <id>.meta.json is written on start and updated on exit so the
 * list endpoint never needs to parse the full JSONL file.
 *
 * MQTT topics (real-time):
 *   ctx/session/<id>/output   -- terminal output chunks
 *   ctx/session/<id>/started  -- session metadata on spawn
 *   ctx/session/<id>/exited   -- exit code
 */

import fs from "fs";
import path from "path";
import type { CtxMqttClient } from "ctx-mqtt";
import { TOPICS } from "ctx-mqtt/topics";
import type { SessionInfo, SocketPty } from "./manager.js";
import { setSessionState } from "./manager.js";
import { broadcastOutput, broadcastExit } from "./broadcast-relay.js";
import { writeSessionMeta, updateSessionMeta } from "../routes/session-logs.js";
import { parsePtyChunk } from "./parse-pty.js";

let mqttClient: CtxMqttClient | null = null;
let logDir: string | null = null;
let rootDir: string | null = null;

export function initSessionLogger(mqtt: CtxMqttClient, root: string): void {
  mqttClient = mqtt;
  rootDir = root;
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

  // Write metadata sidecar for fast listing
  if (rootDir) {
    writeSessionMeta(rootDir, {
      id: info.id,
      command: info.command,
      cwd: info.cwd,
      startedAt: info.startedAt,
      lineCount: 1,
      sizeBytes: 0,
    });
  }

  if (mqttClient?.connected()) {
    mqttClient.publish(TOPICS.session.started(info.id), JSON.stringify(payload));
  }
}

export function logSessionExited(sessionId: string, exitCode: number): void {
  const payload = { type: "exited", exitCode };

  appendLog(sessionId, payload);

  // Update metadata sidecar with exit code
  if (rootDir) {
    updateSessionMeta(rootDir, sessionId, { exitCode });
  }

  if (mqttClient?.connected()) {
    mqttClient.publish(TOPICS.session.exited(sessionId), JSON.stringify(payload));
  }
}

/** Regex matching OSC escape: \x1b]ctx:state=<state>\x07 */
const OSC_STATE_RE = /\x1b\]ctx:state=(running|waiting|idle)\x07/g;

/**
 * Tap a SocketPty connection to stream output to MQTT and the log file.
 * Call this once per session (not per WebSocket client).
 */
export function tapSession(sessionId: string, pty: SocketPty): void {
  pty.onData((data) => {
    // Detect OSC state markers before logging
    let match: RegExpExecArray | null;
    while ((match = OSC_STATE_RE.exec(data)) !== null) {
      const state = match[1];
      setSessionState(sessionId, state);
      if (mqttClient?.connected()) {
        mqttClient.publish(
          TOPICS.session.state(sessionId),
          JSON.stringify({ state }),
        );
      }
    }
    OSC_STATE_RE.lastIndex = 0;

    // Strip OSC markers from logged/broadcast data
    const clean = data.replace(OSC_STATE_RE, "");
    if (clean) {
      const parsed = parsePtyChunk(clean);
      appendLog(sessionId, { type: "output", data: clean });
      if (mqttClient?.connected()) {
        mqttClient.publish(
          TOPICS.session.output(sessionId),
          JSON.stringify(parsed),
        );
      }
      broadcastOutput(sessionId, clean);
    }
  });

  pty.onExit(({ exitCode }) => {
    logSessionExited(sessionId, exitCode);
    broadcastExit(sessionId, exitCode);
    setSessionState(sessionId, "idle");
    if (mqttClient?.connected()) {
      mqttClient.publish(
        TOPICS.session.state(sessionId),
        JSON.stringify({ state: "idle" }),
      );
    }
  });
}
