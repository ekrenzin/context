/**
 * Hybrid routing -- decides whether to handle a prompt locally or via cloud.
 *
 * Local-first by default. Cloud fallback requires an API key and opt-in.
 */

import { isOllamaRunning } from "./ollama.js";
import { detectCapabilities } from "./model-caps.js";
import { getSetting } from "../db/index.js";

export type RouteOverride = "local" | "cloud" | "auto";
export type RoutingMode = "local-only" | "hybrid" | "cloud-only";
export type RouteBackend = "local" | "cloud";

export interface RouteDecision {
  backend: RouteBackend;
  reason: string;
}

export interface RouteRequest {
  maxTokens?: number;
  tools?: boolean;
  route?: RouteOverride;
}

function cloudAvailable(): boolean {
  return !!(getSetting("anthropic_api_key") || getSetting("openai_api_key"));
}

function routingMode(): RoutingMode {
  const mode = getSetting("routing_mode") as RoutingMode | undefined;
  if (mode === "hybrid" || mode === "cloud-only" || mode === "local-only") {
    return mode;
  }
  return "local-only";
}

export async function routePrompt(
  request: RouteRequest,
  modelName: string | null,
  modelSize: number,
): Promise<RouteDecision> {
  // Explicit override always wins
  if (request.route === "cloud") {
    if (!cloudAvailable()) {
      return { backend: "local", reason: "cloud requested but no API key configured" };
    }
    return { backend: "cloud", reason: "explicit cloud override" };
  }
  if (request.route === "local") {
    return { backend: "local", reason: "explicit local override" };
  }

  const mode = routingMode();

  // Cloud-only mode
  if (mode === "cloud-only") {
    if (!cloudAvailable()) {
      return { backend: "local", reason: "cloud-only mode but no API key, falling back to local" };
    }
    return { backend: "cloud", reason: "cloud-only routing mode" };
  }

  // Local-only mode
  if (mode === "local-only") {
    return { backend: "local", reason: "local-only routing mode" };
  }

  // Hybrid mode -- decide based on capability
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp || !modelName) {
    if (cloudAvailable()) {
      return { backend: "cloud", reason: "ollama unavailable, using cloud fallback" };
    }
    return { backend: "local", reason: "ollama unavailable, no cloud fallback" };
  }

  const caps = detectCapabilities(modelName, modelSize);
  const threshold = Number(getSetting("cloud_fallback_threshold")) || 1000;
  const requestedTokens = request.maxTokens ?? 200;

  // Route to cloud if request exceeds local capability
  if (requestedTokens > threshold) {
    if (cloudAvailable()) {
      return {
        backend: "cloud",
        reason: `requested ${requestedTokens} tokens exceeds threshold ${threshold}`,
      };
    }
  }

  // Route to cloud if tools requested but model doesn't support them
  if (request.tools && !caps.supportsTools) {
    if (cloudAvailable()) {
      return {
        backend: "cloud",
        reason: `tools requested but ${modelName} (${caps.tier}) does not support tool use`,
      };
    }
  }

  return { backend: "local", reason: "within local model capability" };
}
