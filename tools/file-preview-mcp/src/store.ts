import type { PreviewEntry } from "./types.js";

type Listener = (entry: PreviewEntry) => void;

const entries: PreviewEntry[] = [];
const listeners: Set<Listener> = new Set();

export function addEntry(entry: PreviewEntry): void {
  entries.push(entry);
  for (const fn of listeners) fn(entry);
}

export function getEntries(): PreviewEntry[] {
  return entries;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clear(): void {
  entries.length = 0;
}
