import fs from "fs";
import path from "path";
import { getSetting, setSetting } from "../db/index.js";

export interface ScanState {
  processed: Record<string, { size: number; scannedAt: string }>;
}

const STATE_KEY = "profiler_scan_state";

function loadState(): ScanState {
  const raw = getSetting(STATE_KEY);
  if (!raw) return { processed: {} };
  try {
    return JSON.parse(raw) as ScanState;
  } catch {
    return { processed: {} };
  }
}

function saveState(state: ScanState): void {
  setSetting(STATE_KEY, JSON.stringify(state));
}

function findTranscriptDirs(): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const dirs: string[] = [];

  const cursorBase = path.join(home, ".cursor", "projects");
  if (fs.existsSync(cursorBase)) {
    for (const entry of fs.readdirSync(cursorBase, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const tDir = path.join(cursorBase, entry.name, "agent-transcripts");
        if (fs.existsSync(tDir)) dirs.push(tDir);
      }
    }
  }

  const claudeDir = path.join(home, ".claude");
  if (fs.existsSync(claudeDir)) dirs.push(claudeDir);

  return dirs;
}

export interface PendingTranscript {
  path: string;
  chatId: string;
  size: number;
}

export function scanForNew(full = false): PendingTranscript[] {
  const state = loadState();
  const pending: PendingTranscript[] = [];

  for (const dir of findTranscriptDirs()) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl") || f.endsWith(".txt"));

    for (const file of files.sort()) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const chatId = file.replace(/\.(jsonl|txt)$/, "");
      const prev = state.processed[filePath];

      if (!full && prev && prev.size === stat.size) continue;

      pending.push({ path: filePath, chatId, size: stat.size });
    }
  }

  return pending;
}

export function markProcessed(filePath: string, size: number): void {
  const state = loadState();
  state.processed[filePath] = { size, scannedAt: new Date().toISOString() };
  saveState(state);
}
