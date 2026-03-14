/**
 * Model capability detection for Ollama models.
 *
 * Determines what a model can do (tool use, token limits) based on
 * its parameter count and known model families.
 */

const BASE_URL = "http://127.0.0.1:11434";

export type ModelTier = "small" | "medium" | "large";

export interface ModelCapabilities {
  tier: ModelTier;
  supportsTools: boolean;
  maxUsefulTokens: number;
}

/** Model families known to support Ollama tool/function calling. */
const TOOL_CAPABLE_FAMILIES = [
  "qwen2.5",
  "qwen2",
  "llama3.1",
  "llama3.2",
  "llama3.3",
  "mistral",
  "mixtral",
  "command-r",
  "deepseek-v2",
  "firefunction",
  "hermes",
];

function extractFamily(modelName: string): string {
  return modelName.split(":")[0].toLowerCase();
}

function estimateParams(sizeBytes: number): number {
  // Rough estimate: quantized models ~0.6 bytes per param on average
  return sizeBytes / 0.6e9;
}

function tierFromParams(params: number): ModelTier {
  if (params < 2) return "small";
  if (params < 20) return "medium";
  return "large";
}

const TIER_LIMITS: Record<ModelTier, { maxUsefulTokens: number }> = {
  small: { maxUsefulTokens: 200 },
  medium: { maxUsefulTokens: 1000 },
  large: { maxUsefulTokens: 4000 },
};

export function detectCapabilities(
  modelName: string,
  sizeBytes: number,
): ModelCapabilities {
  const family = extractFamily(modelName);
  const params = estimateParams(sizeBytes);
  const tier = tierFromParams(params);
  const familySupportsTools = TOOL_CAPABLE_FAMILIES.some((f) => family.startsWith(f));
  const supportsTools = familySupportsTools && tier !== "small";

  return {
    tier,
    supportsTools,
    maxUsefulTokens: TIER_LIMITS[tier].maxUsefulTokens,
  };
}

export interface ModelInfo {
  name: string;
  size: number;
  tier: ModelTier;
  supportsTools: boolean;
  maxUsefulTokens: number;
}

export async function getModelInfo(modelName: string): Promise<ModelInfo | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE_URL}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const size = data.size ?? 0;
    const caps = detectCapabilities(modelName, size);
    return { name: modelName, size, ...caps };
  } catch {
    return null;
  }
}

export async function listModelsWithCaps(): Promise<ModelInfo[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map(
      (m: { name: string; size: number }) => {
        const caps = detectCapabilities(m.name, m.size);
        return { name: m.name, size: m.size, ...caps };
      },
    );
  } catch {
    return [];
  }
}
