import * as path from "path";
import { createHash } from "crypto";
import { generate, isOllamaRunning } from "../ai/ollama.js";
import { getSetting } from "../db/index.js";

const ADJECTIVES = [
  "swift", "nimble", "bold", "keen", "calm",
  "vivid", "crisp", "brisk", "warm", "cool",
  "bright", "sleek", "quiet", "sharp", "fresh",
  "steady", "plucky", "deft", "agile", "lucid",
];

export async function generateName(command: string, cwd: string): Promise<string> {
  try {
    const name = await ollamaName(command, cwd);
    if (name) return name;
  } catch { /* fall through */ }
  return fallbackName(command, cwd);
}

async function ollamaName(command: string, cwd: string): Promise<string | null> {
  const model = getSetting("ollama_model");
  if (!model) return null;
  if (!(await isOllamaRunning())) return null;

  const dir = path.basename(cwd);
  const prompt = [
    "Name this terminal session in 2-3 creative words.",
    `Command: ${command}`,
    `Directory: ${dir}`,
    "Reply with ONLY the name, nothing else.",
  ].join("\n");

  const raw = await generate(prompt, model, { temperature: 0.8, maxTokens: 20 });
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\n.*/s, "")
    .slice(0, 40);

  return cleaned || null;
}

function fallbackName(command: string, cwd: string): string {
  const dir = path.basename(cwd);
  const hash = createHash("md5").update(`${command}:${cwd}:${Date.now()}`).digest();
  const idx = hash[0] % ADJECTIVES.length;
  return `${ADJECTIVES[idx]}-${dir}`;
}
