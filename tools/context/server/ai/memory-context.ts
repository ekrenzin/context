import { scan } from "../memory/index.js";
import type { MemoryEntry } from "../memory/index.js";
import type { ClassificationResult } from "./classifier.js";

export interface MemoryContext {
  entries: { id: string; type: string; title: string; content: string }[];
  summary: string;
}

const TYPE_PRIORITY: Record<string, number> = {
  preferences: 0,
  decisions: 1,
  observations: 2,
  progress: 3,
  "known-issues": 4,
  environment: 5,
};

const MAX_ENTRIES = 10;

export async function queryRelevantMemory(
  input: string,
  classification: ClassificationResult,
): Promise<MemoryContext> {
  const allEntries: MemoryEntry[] = [];
  const seen = new Set<string>();

  const collect = (entries: MemoryEntry[]) => {
    for (const e of entries) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        allEntries.push(e);
      }
    }
  };

  // Always load preferences (user rules)
  collect(scan({ type: "preferences", limit: 20 }));
  collect(scan({ type: "observations", limit: 10 }));

  // Repo-scoped entries
  if (classification.repo) {
    collect(scan({ repo: classification.repo, limit: 10 }));
  }

  // Keyword-matched entries from input
  collect(scan({ query: input, limit: 15 }));

  // Sort by type priority, then recency
  allEntries.sort((a, b) => {
    const pa = TYPE_PRIORITY[a.type] ?? 99;
    const pb = TYPE_PRIORITY[b.type] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const capped = allEntries.slice(0, MAX_ENTRIES);
  const entries = capped.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    content: e.content,
  }));

  return { entries, summary: formatSummary(capped) };
}

function formatSummary(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  const grouped = new Map<string, MemoryEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.type) ?? [];
    list.push(e);
    grouped.set(e.type, list);
  }

  const sections: string[] = ["## User Context (from memory)"];
  for (const [type, items] of grouped) {
    sections.push(`### ${type}`);
    for (const item of items) {
      sections.push(`- **${item.title}**: ${item.content.slice(0, 200)}`);
    }
  }

  return sections.join("\n");
}
