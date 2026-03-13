import { apiGet, apiPost } from "../client.js";

interface MemoryEntry {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  repo?: string;
  createdAt: string;
}

export async function scan(query?: string, type?: string, repo?: string): Promise<void> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (type) params.set("type", type);
  if (repo) params.set("repo", repo);

  const entries = await apiGet<MemoryEntry[]>(`/api/memory?${params}`);

  if (entries.length === 0) {
    console.log("No memory entries found.");
    return;
  }

  for (const e of entries) {
    console.log(`[${e.type}] ${e.title}`);
    console.log(`  ${e.content.slice(0, 120)}`);
    console.log();
  }
}

export async function write(opts: {
  type: string;
  title: string;
  body: string;
  repo?: string;
  ticket?: string;
}): Promise<void> {
  const entry = await apiPost<MemoryEntry>("/api/memory", {
    type: opts.type,
    title: opts.title,
    content: opts.body,
    repo: opts.repo,
    ticket: opts.ticket,
  });

  console.log(`Written: ${entry.id}`);
}
