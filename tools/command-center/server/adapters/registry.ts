import fs from "fs";
import path from "path";
import type { IdeAdapter, SyncResult } from "./types.js";
import { executeLaunch, type LaunchOutcome } from "./launcher.js";
import { cursorAdapter } from "./cursor.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { windsurfAdapter } from "./windsurf.js";
import { codexAdapter } from "./codex.js";

const ALL_ADAPTERS: IdeAdapter[] = [
  cursorAdapter,
  claudeCodeAdapter,
  windsurfAdapter,
  codexAdapter,
];

export function getAdapter(name: string): IdeAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.name === name);
}

export function listAdapters(): IdeAdapter[] {
  return ALL_ADAPTERS;
}

export function syncAll(root: string, enabledIdes: string[]): Record<string, SyncResult> {
  const results: Record<string, SyncResult> = {};

  for (const adapter of ALL_ADAPTERS) {
    if (!enabledIdes.includes(adapter.name)) continue;
    results[adapter.name] = adapter.sync(root);
  }

  return results;
}

export async function launchIde(root: string, ideName: string): Promise<LaunchOutcome | null> {
  const adapter = getAdapter(ideName);
  if (!adapter) return null;
  adapter.sync(root);
  const result = adapter.launch(root);
  return executeLaunch(ideName, result, root);
}

export function createWatcher(
  root: string,
  enabledIdes: string[],
  onChange?: (results: Record<string, SyncResult>) => void,
): { close(): void } {
  const watchDirs = ["rules", "skills"].map((d) => path.join(root, d)).filter(fs.existsSync);

  if (watchDirs.length === 0) return { close() {} };

  let debounce: ReturnType<typeof setTimeout> | null = null;

  const watchers = watchDirs.map((dir) =>
    fs.watch(dir, { recursive: true }, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const results = syncAll(root, enabledIdes);
        onChange?.(results);
      }, 500);
    }),
  );

  return {
    close() {
      if (debounce) clearTimeout(debounce);
      watchers.forEach((w) => w.close());
    },
  };
}
