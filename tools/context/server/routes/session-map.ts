import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type {
  SessionMapNode,
  SessionMapEdge,
  SessionMapData,
} from "../types.js";
import { loadSessions } from "./sessions.js";

const MAX_NODES = 1000;
const SKILL_MULT = 5;
const REPO_MULT = 100;
const MIN_EDGE_WEIGHT = 10;
const SKILL_MAX_FREQ = 0.15;
const REPO_MAX_FREQ = 0.40;

const REPO_PATTERNS: Record<string, string[]> = {};

const REPO_DETECT_WEIGHT: Record<string, number> = {};

function countOccurrences(text: string, pattern: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(pattern, pos)) !== -1) {
    count++;
    pos += pattern.length;
  }
  return count;
}

function detectRepos(
  transcriptDir: string,
  chatId: string,
  firstQuery: string,
): string[] {
  const sources = [firstQuery];
  for (const ext of [".txt", ".jsonl"]) {
    try {
      const p = path.join(transcriptDir, `${chatId}${ext}`);
      if (fs.existsSync(p)) {
        sources.push(fs.readFileSync(p, { encoding: "utf8" }).slice(0, 6000));
        break;
      }
    } catch {
      /* skip unreadable */
    }
  }
  const combined = sources.join(" ");
  return Object.entries(REPO_PATTERNS)
    .map(([repo, patterns]) => {
      const raw = patterns.reduce(
        (sum, pat) => sum + countOccurrences(combined, pat),
        0,
      );
      const weight = REPO_DETECT_WEIGHT[repo] ?? 1;
      return { repo, hits: raw * weight };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(({ repo }) => repo);
}

function buildIdf(
  freq: Map<string, number>,
  total: number,
): Map<string, number> {
  const idf = new Map<string, number>();
  const n = Math.max(1, total);
  for (const [key, count] of freq) {
    idf.set(key, Math.log(n / count));
  }
  return idf;
}

function pickTheme(skills: string[], idf: Map<string, number>): string {
  let best = "";
  let bestScore = -1;
  for (const s of skills) {
    const score = idf.get(s) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function buildSessionMap(root: string, transcriptDir: string): SessionMapData {
  const { records } = loadSessions(root, 0, MAX_NODES);
  const total = records.length || 1;

  const skillFreq = new Map<string, number>();
  const repoFreq = new Map<string, number>();
  const nodeRepos: string[][] = [];

  for (const r of records) {
    const repos = detectRepos(transcriptDir, r.chatId, r.firstQuery ?? "");
    nodeRepos.push(repos);
    for (const s of r.skills) skillFreq.set(s, (skillFreq.get(s) ?? 0) + 1);
    for (const repo of repos) repoFreq.set(repo, (repoFreq.get(repo) ?? 0) + 1);
  }

  const skillCutoff = Math.floor(total * SKILL_MAX_FREQ);
  const ubiquitousSkills = new Set(
    [...skillFreq.entries()]
      .filter(([, count]) => count > skillCutoff)
      .map(([skill]) => skill),
  );

  const repoCutoff = Math.floor(total * REPO_MAX_FREQ);
  const ubiquitousRepos = new Set(
    [...repoFreq.entries()]
      .filter(([, count]) => count > repoCutoff)
      .map(([repo]) => repo),
  );

  const skillIdf = buildIdf(skillFreq, total);
  const repoIdf = buildIdf(repoFreq, total);

  const nodes: SessionMapNode[] = records.map((r, i) => ({
    id: r.chatId,
    title: r.title || r.firstQuery?.slice(0, 60) || r.chatId.slice(0, 8),
    date: r.date,
    verdict: r.verdict || "unanalyzed",
    skills: r.skills,
    theme: pickTheme(r.skills, skillIdf),
    totalCalls: r.totalCalls,
    userTurns: r.userTurns,
    repos: nodeRepos[i],
  }));

  const edges: SessionMapEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const skillsA = new Set(nodes[i].skills);
    const reposA = new Set(nodeRepos[i]);

    for (let j = i + 1; j < nodes.length; j++) {
      let weight = 0;
      const labels: Array<{ label: string; score: number }> = [];

      for (const s of nodes[j].skills) {
        if (skillsA.has(s) && !ubiquitousSkills.has(s)) {
          const score = (skillIdf.get(s) ?? 0) * SKILL_MULT;
          weight += score;
          labels.push({ label: s, score });
        }
      }
      for (const repo of nodeRepos[j]) {
        if (reposA.has(repo) && !ubiquitousRepos.has(repo)) {
          const score = (repoIdf.get(repo) ?? 0) * REPO_MULT;
          weight += score;
          labels.push({ label: `repo:${repo}`, score });
        }
      }

      if (weight >= MIN_EDGE_WEIGHT) {
        labels.sort((a, b) => b.score - a.score);
        edges.push({
          source: nodes[i].id,
          target: nodes[j].id,
          weight: Math.round(weight * 100) / 100,
          sharedSkills: labels.slice(0, 8).map((l) => l.label),
        });
      }
    }
  }

  return { nodes, edges };
}

export function registerSessionMapRoutes(
  app: FastifyInstance,
  root: string,
  transcriptDir: string,
): void {
  app.get("/api/sessions/map", async () =>
    buildSessionMap(root, transcriptDir),
  );
}
