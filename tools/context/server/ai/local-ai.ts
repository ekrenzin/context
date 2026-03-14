/**
 * MQTT-driven local AI background service.
 *
 * Subscribes to workspace events and reacts via a local Ollama model.
 * Features:
 *   1. Session naming — reacts to ctx/session/+/started
 *   2. General prompt — publish to ctx/local-ai/prompt, get reply on ctx/local-ai/reply
 */

import * as path from "path";
import * as fs from "fs";
import { createHash } from "crypto";
import type { CtxMqttClient } from "ctx-mqtt";
import { generate, isOllamaRunning, listModels } from "./ollama.js";
import { chat, runWithTools } from "./tool-runner.js";
import { routePrompt } from "./router.js";
import { detectCapabilities } from "./model-caps.js";
import { complete } from "./client.js";
import { getSetting, getProject } from "../db/index.js";
import { setSessionLabel } from "../terminal/manager.js";

const ADJECTIVES = [
  "swift", "nimble", "bold", "keen", "calm",
  "vivid", "crisp", "brisk", "warm", "cool",
  "bright", "sleek", "quiet", "sharp", "fresh",
  "steady", "plucky", "deft", "agile", "lucid",
];

const STATUS_TOPIC = "ctx/local-ai/status";
const SYSTEM_PROMPT_CACHE_MS = 60_000;

let cachedSystemPrompt: string | null = null;
let systemPromptBuiltAt = 0;

function buildSystemPrompt(): string {
  const now = Date.now();
  if (cachedSystemPrompt && now - systemPromptBuiltAt < SYSTEM_PROMPT_CACHE_MS) {
    return cachedSystemPrompt;
  }

  const parts: string[] = [
    "You are the local AI assistant for Context Command Center,",
    "a developer workspace that coordinates repos via an MQTT message bus.",
    "Answer concisely. You have knowledge of this specific project.",
  ];

  // Load project context from the default project's root
  const projectId = getSetting("default_terminal_project");
  const project = projectId ? getProject(projectId) : undefined;
  const root = project?.root_path;

  if (root) {
    parts.push("", `Project: ${project!.name ?? project!.slug ?? projectId}`);
    if (project!.description) parts.push(project!.description);

    for (const file of ["CLAUDE.md", "AGENTS.md"]) {
      const fp = path.join(root, file);
      try {
        const content = fs.readFileSync(fp, "utf-8").slice(0, 2000);
        parts.push("", `--- ${file} ---`, content);
      } catch { /* file may not exist */ }
    }
  }

  cachedSystemPrompt = parts.join("\n");
  systemPromptBuiltAt = now;
  return cachedSystemPrompt;
}

export interface LocalAiService {
  start(): void;
  stop(): void;
}

/** How long to wait after last output before re-naming. */
const RENAME_DEBOUNCE_MS = 8_000;
/** Shorter debounce for the first rename so "NEW SESSION" is replaced quickly. */
const FIRST_RENAME_DEBOUNCE_MS = 3_000;
/** Max recent output chars to send to the model for context. */
const OUTPUT_BUFFER_SIZE = 600;

interface SessionBuffer {
  output: string;
  command: string;
  cwd: string;
  timer: ReturnType<typeof setTimeout> | null;
  lastRenamed: number;
  named: boolean;
}

export function createLocalAi(mqtt: CtxMqttClient): LocalAiService {
  const handlers: Array<{ topic: string; active: boolean }> = [];
  const sessionBuffers = new Map<string, SessionBuffer>();

  function start(): void {
    listenSessionStarted();
    listenSessionOutput();
    listenSessionExited();
    listenPrompt();
    publishStatus("online");
    console.log("[local-ai] service started");
  }

  function stop(): void {
    for (const h of handlers) h.active = false;
    handlers.length = 0;
    for (const buf of sessionBuffers.values()) {
      if (buf.timer) clearTimeout(buf.timer);
    }
    sessionBuffers.clear();
    publishStatus("offline");
  }

  // ── Session naming (initial) ────────────────────────────────────

  function listenSessionStarted(): void {
    const topic = "ctx/session/+/started";
    const handle = { topic, active: true };
    handlers.push(handle);

    mqtt.subscribe(topic, (_t, payload) => {
      if (!handle.active) return;

      const match = _t.match(/^ctx\/session\/([^/]+)\/started$/);
      if (!match) return;
      const sessionId = match[1];

      try {
        const data = JSON.parse(payload.toString());

        sessionBuffers.set(sessionId, {
          output: "",
          command: data.command ?? "",
          cwd: data.cwd ?? "",
          timer: null,
          lastRenamed: 0,
          named: false,
        });

        const label = "NEW SESSION";
        setSessionLabel(sessionId, label);
        mqtt.publish(
          `ctx/session/${sessionId}/label`,
          JSON.stringify({ label }),
        );
      } catch { /* best effort */ }
    });
  }

  // ── Session output tracking (ongoing rename) ────────────────────

  function listenSessionOutput(): void {
    const topic = "ctx/session/+/output";
    const handle = { topic, active: true };
    handlers.push(handle);

    mqtt.subscribe(topic, (t, payload) => {
      if (!handle.active) return;

      const match = t.match(/^ctx\/session\/([^/]+)\/output$/);
      if (!match) return;
      const sessionId = match[1];

      const buf = sessionBuffers.get(sessionId);
      if (!buf) return;

      const chunk = payload.toString();
      buf.output = (buf.output + chunk).slice(-OUTPUT_BUFFER_SIZE);

      if (buf.timer) clearTimeout(buf.timer);
      const delay = buf.named ? RENAME_DEBOUNCE_MS : FIRST_RENAME_DEBOUNCE_MS;
      buf.timer = setTimeout(() => {
        buf.timer = null;
        triggerRename(sessionId).catch(() => {});
      }, delay);
    });
  }

  // ── Cleanup on exit ─────────────────────────────────────────────

  function listenSessionExited(): void {
    const topic = "ctx/session/+/exited";
    const handle = { topic, active: true };
    handlers.push(handle);

    mqtt.subscribe(topic, (t) => {
      if (!handle.active) return;
      const match = t.match(/^ctx\/session\/([^/]+)\/exited$/);
      if (!match) return;
      const buf = sessionBuffers.get(match[1]);
      if (buf?.timer) clearTimeout(buf.timer);
      sessionBuffers.delete(match[1]);
    });
  }

  // ── Rename with recent output context ───────────────────────────

  async function triggerRename(sessionId: string): Promise<void> {
    const buf = sessionBuffers.get(sessionId);
    if (!buf || !buf.output.trim()) return;

    const now = Date.now();
    const isFirst = !buf.named;

    const model = getSetting("ollama_model");
    if (!model || !(await isOllamaRunning())) {
      if (isFirst) {
        const label = fallbackLabel(buf.command, buf.cwd);
        buf.named = true;
        buf.lastRenamed = now;
        setSessionLabel(sessionId, label);
        mqtt.publish(
          `ctx/session/${sessionId}/label`,
          JSON.stringify({ label }),
        );
      }
      return;
    }

    const label = await ollamaRelabel(
      buf.command, buf.cwd, buf.output, model,
    );
    if (!label) return;

    buf.named = true;
    buf.lastRenamed = now;
    setSessionLabel(sessionId, label);
    mqtt.publish(
      `ctx/session/${sessionId}/label`,
      JSON.stringify({ label }),
    );
  }

  // ── General prompt (with routing + tool use) ───────────────────

  function listenPrompt(): void {
    const topic = "ctx/local-ai/prompt";
    const handle = { topic, active: true };
    handlers.push(handle);

    mqtt.subscribe(topic, async (_t, payload) => {
      if (!handle.active) return;

      try {
        const data = JSON.parse(payload.toString());
        const prompt: string = data.prompt;
        const replyTo: string = data.replyTo ?? "ctx/local-ai/reply";
        const maxTokens: number = data.maxTokens ?? 200;
        const temperature: number = data.temperature ?? 0.7;
        const tools: boolean = data.tools ?? false;
        const route: string | undefined = data.route;

        if (!prompt) return;

        const modelName = getSetting("ollama_model") ?? null;
        const modelSize = await getModelSize(modelName);

        const decision = await routePrompt(
          { maxTokens, tools, route: route as "local" | "cloud" | "auto" | undefined },
          modelName,
          modelSize,
        );

        // Publish routing decision for observability
        mqtt.publish("ctx/local-ai/routed", JSON.stringify({
          backend: decision.backend,
          reason: decision.reason,
          model: modelName,
          tokens: maxTokens,
        }));

        if (decision.backend === "cloud") {
          const system = buildSystemPrompt();
          const result = await complete({ prompt, system, maxTokens, temperature });
          mqtt.publish(replyTo, JSON.stringify({
            ok: true,
            response: result.text,
            backend: "cloud",
            provider: result.provider,
          }));
          return;
        }

        // Local path
        if (!modelName || !(await isOllamaRunning())) {
          mqtt.publish(replyTo, JSON.stringify({
            ok: false,
            error: "no model configured or ollama not running",
          }));
          return;
        }

        const system = buildSystemPrompt();

        if (tools) {
          const result = await runWithTools({
            model: modelName,
            modelSize,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            tools: true,
            temperature,
            maxTokens,
          });
          mqtt.publish(replyTo, JSON.stringify({
            ok: true,
            response: result.response,
            backend: "local",
            toolCalls: result.toolCalls.length,
            iterations: result.iterations,
          }));
        } else {
          const response = await chat(prompt, modelName, {
            temperature,
            maxTokens,
            system,
          });
          mqtt.publish(replyTo, JSON.stringify({
            ok: true,
            response,
            backend: "local",
          }));
        }
      } catch (err) {
        mqtt.publish("ctx/local-ai/reply", JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    });
  }

  async function getModelSize(modelName: string | null): Promise<number> {
    if (!modelName) return 0;
    try {
      const models = await listModels();
      const found = models.find((m) => m.name === modelName);
      return found?.size ?? 0;
    } catch {
      return 0;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  function publishStatus(status: string): void {
    const model = getSetting("ollama_model") ?? null;
    mqtt.publish(STATUS_TOPIC, { status, model }, true);
  }

  return { start, stop };
}

// ── Label generation ────────────────────────────────────────────────

function fallbackLabel(command: string, cwd: string): string {
  const dir = path.basename(cwd);
  const hash = createHash("md5")
    .update(`${command}:${cwd}:${Date.now()}`)
    .digest();
  const idx = hash[0] % ADJECTIVES.length;
  return `${ADJECTIVES[idx]}-${dir}`;
}

// ── Ongoing relabeling with output context ───────────────────────

async function ollamaRelabel(
  command: string,
  cwd: string,
  recentOutput: string,
  model: string,
): Promise<string | null> {
  const dir = path.basename(cwd);
  // Strip ANSI escape codes for cleaner context
  const cleaned = recentOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();
  if (!cleaned) return null;

  const prompt = [
    "Name this terminal session in 2-4 separate words based on the user's task.",
    "Each word must be separated by a space. Title Case. No quotes or punctuation.",
    "",
    "Examples of GOOD names:",
    "- Fix Auth Middleware",
    "- Debug API Routes",
    "- Refactor Session Naming",
    "- Add Unit Tests",
    "- Setup CI Pipeline",
    "- Clean Up Imports",
    "",
    "Examples of BAD names (never do these):",
    "- claudemerge (words not separated)",
    "- fixbugs (words not separated)",
    "- AI Chat (too generic)",
    "- Claude Code Session (names the tool, not the task)",
    "",
    "Focus on WHAT the user is doing, not which tool they are using.",
    "If the user is talking to an AI assistant, name it after the task discussed.",
    "",
    `Command: ${command}`,
    `Directory: ${dir}`,
    `Recent activity:`,
    cleaned.slice(-500),
    "",
    "Session name:",
  ].join("\n");

  try {
    const raw = await generate(prompt, model, {
      temperature: 0.4,
      maxTokens: 20,
    });
    const label = raw
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\n.*/s, "")
      // Split camelCase/PascalCase words the model may have joined
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .slice(0, 40);
    return label || null;
  } catch {
    return null;
  }
}
