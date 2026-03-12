import { execFileSync } from "child_process";
import { spawn } from "child_process";

const BASE_URL = "http://127.0.0.1:11434";

export function isOllamaInstalled(): boolean {
  try {
    execFileSync("which", ["ollama"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function ollamaVersion(): string | null {
  try {
    const out = execFileSync("ollama", ["--version"], { stdio: "pipe" });
    const match = out.toString().match(/[\d.]+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function installOllama(): Promise<{ success: boolean; error?: string }> {
  let cmd: string;
  let args: string[];
  try {
    execFileSync("which", ["brew"], { stdio: "pipe" });
    cmd = "brew";
    args = ["install", "ollama"];
  } catch {
    cmd = "sh";
    args = ["-c", "curl -fsSL https://ollama.com/install.sh | sh"];
  }

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "pipe" });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: "Installation timed out after 120s" });
    }, 120_000);
  });
}

export async function ensureServing(): Promise<void> {
  if (await isOllamaRunning()) return;

  const child = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isOllamaRunning()) return;
  }
  throw new Error("Ollama did not start within 10s");
}

export interface OllamaModel {
  name: string;
  size: number;
}

export async function listModels(): Promise<OllamaModel[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const res = await fetch(`${BASE_URL}/api/tags`, { signal: ctrl.signal });
  clearTimeout(timer);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string; size: number }) => ({
    name: m.name,
    size: m.size,
  }));
}

export async function pullModel(
  name: string,
  onProgress?: (status: string, completed?: number, total?: number) => void,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Pull failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        onProgress?.(msg.status, msg.completed, msg.total);
      } catch { /* skip malformed */ }
    }
  }
}

export async function generate(
  prompt: string,
  model: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: opts?.temperature ?? 0.8,
        num_predict: opts?.maxTokens ?? 20,
      },
    }),
    signal: ctrl.signal,
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  const data = await res.json();
  return data.response ?? "";
}
