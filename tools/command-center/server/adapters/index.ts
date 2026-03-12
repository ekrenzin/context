export type { IdeAdapter, SyncResult, LaunchResult } from "./types.js";
export { cursorAdapter } from "./cursor.js";
export { claudeCodeAdapter } from "./claude-code.js";
export { windsurfAdapter } from "./windsurf.js";
export { codexAdapter } from "./codex.js";
export { getAdapter, syncAll, launchIde, listAdapters, createWatcher } from "./registry.js";
