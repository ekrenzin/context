import fs from "fs";
import { scanForNew, markProcessed } from "./scanner.js";
import { parseTranscript } from "./parser.js";
import { analyzeSession } from "./analyzer.js";
import { upsertSession } from "../db/index.js";
import { getSetting } from "../db/index.js";
import type { CtxMqttClient } from "ctx-mqtt";

interface LoopOptions {
  root: string;
  mqtt: CtxMqttClient;
  intervalMs?: number;
}

export function createSelfManagementLoop(opts: LoopOptions) {
  const { root, mqtt, intervalMs = 30_000 } = opts;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;

    try {
      const pending = scanForNew();
      if (pending.length === 0) return;

      mqtt.publish("ctx/analysis/started", { count: pending.length });

      for (const t of pending) {
        const session = parseTranscript(t.path, t.chatId);

        upsertSession({
          chat_id: session.chatId,
          title: "",
          summary: "",
          verdict: "",
          first_query: session.firstQuery,
          date: session.date,
          timestamp: session.timestamp,
          file_bytes: session.fileBytes,
          user_turns: session.userTurns,
          assistant_turns: session.assistantTurns,
          total_calls: session.totalCalls,
          tools: JSON.stringify(session.tools),
          skills: JSON.stringify(session.skills),
          skill_counts: JSON.stringify(session.skillCounts),
          subagent_types: JSON.stringify(session.subagentTypes),
          plan_mode: session.planMode ? 1 : 0,
          thinking_blocks: session.thinkingBlocks,
          response_chars_total: session.responseCharsTotal,
          response_chars_avg: session.responseCharsAvg,
          response_chars_max: session.responseCharsMax,
          analysis: null,
        });

        const mode = getSetting("profiler_mode") ?? "suggest";
        if (mode === "auto") {
          try {
            await analyzeSession(session, t.path);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            mqtt.publish("ctx/analysis/error", { chatId: t.chatId, error: msg });
          }
        }

        markProcessed(t.path, t.size);
      }

      mqtt.publish("ctx/analysis/complete", { processed: pending.length });
    } finally {
      running = false;
    }
  }

  return {
    start() {
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async runOnce() {
      await tick();
    },
  };
}
