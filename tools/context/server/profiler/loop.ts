import { scanForNew, markProcessed } from "./scanner.js";
import { parseTranscript } from "./parser.js";
import { analyzeSession } from "./analyzer.js";
import { upsertSession } from "../db/index.js";
import { getSetting } from "../db/index.js";
import type { CtxMqttClient } from "ctx-mqtt";

type ProfilerPhase = "idle" | "scanning" | "analyzing" | "synthesizing";

interface LoopOptions {
  root: string;
  mqtt: CtxMqttClient;
  intervalMs?: number;
}

function publishStatus(mqtt: CtxMqttClient, phase: ProfilerPhase, detail: string): void {
  mqtt.publish("ctx/profiler/status", { phase, detail, timestamp: new Date().toISOString() });
}

function publishActivity(mqtt: CtxMqttClient, action: string): void {
  mqtt.publish("ctx/profiler/activity", { action, timestamp: new Date().toISOString() });
}

export function createSelfManagementLoop(opts: LoopOptions) {
  const { root, mqtt, intervalMs = 30_000 } = opts;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;

    try {
      publishStatus(mqtt, "scanning", "Scanning for new transcripts...");
      publishActivity(mqtt, "Scan started");

      const pending = scanForNew();
      if (pending.length === 0) {
        publishStatus(mqtt, "idle", "Watching for new sessions");
        publishActivity(mqtt, "No new transcripts found");
        return;
      }

      publishStatus(mqtt, "scanning", `Found ${pending.length} new transcript(s)`);
      publishActivity(mqtt, `Found ${pending.length} new transcript(s)`);
      mqtt.publish("ctx/analysis/started", { count: pending.length });

      for (const t of pending) {
        publishStatus(mqtt, "analyzing", `Parsing: ${t.chatId}`);
        publishActivity(mqtt, `Parsing transcript: ${t.chatId}`);

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

        publishActivity(mqtt, `Session stored: ${session.chatId}`);

        const mode = getSetting("profiler_mode") ?? "suggest";
        if (mode === "auto") {
          try {
            const title = session.firstQuery.slice(0, 60);
            publishStatus(mqtt, "analyzing", `Analyzing: ${title}`);
            publishActivity(mqtt, `Analyzing session: ${session.chatId}`);
            await analyzeSession(session, t.path);
            publishActivity(mqtt, `Analysis complete: ${session.chatId}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            mqtt.publish("ctx/analysis/error", { chatId: t.chatId, error: msg });
            publishActivity(mqtt, `Analysis failed: ${session.chatId}`);
          }
        }

        markProcessed(t.path, t.size);
      }

      mqtt.publish("ctx/analysis/complete", { processed: pending.length });
      publishStatus(mqtt, "idle", "Watching for new sessions");
      publishActivity(mqtt, `Processed ${pending.length} transcript(s)`);
    } finally {
      running = false;
    }
  }

  return {
    start() {
      publishStatus(mqtt, "idle", "Watching for new sessions");
      tick();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      publishStatus(mqtt, "idle", "Profiler stopped");
    },
    async runOnce() {
      await tick();
    },
  };
}
