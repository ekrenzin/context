import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { StatsOverview, TrendDirection } from "../types.js";
import { loadSessions } from "./sessions.js";

function computeTrend(recentVal: number, olderVal: number): TrendDirection {
  if (olderVal === 0 && recentVal === 0) return { direction: "neutral", delta: 0 };
  if (olderVal === 0) return { direction: "up", delta: 100 };
  const pct = Math.round(((recentVal - olderVal) / olderVal) * 100);
  if (pct > 10) return { direction: "up", delta: pct };
  if (pct < -10) return { direction: "down", delta: pct };
  return { direction: "neutral", delta: pct };
}

export function loadStatsOverview(root: string): StatsOverview | null {
  const allSessions = loadSessions(root, 0, 100000);
  if (allSessions.total === 0) return null;

  const records = allSessions.records;
  const analysesDir = path.join(root, "memory", "profile", "analyses");
  let analyzedCount = 0;
  const verdictsByDate: Record<string, string[]> = {};
  const efficiencyScores: number[] = [];

  for (const r of records) {
    const dateKey = r.timestamp ? r.timestamp.slice(0, 10) : r.date;
    if (!dateKey) continue;
    if (!verdictsByDate[dateKey]) verdictsByDate[dateKey] = [];

    try {
      const aPath = path.join(analysesDir, `${r.chatId}.json`);
      const raw = JSON.parse(fs.readFileSync(aPath, "utf8")) as Record<string, unknown>;
      analyzedCount++;
      const verdict = (raw.verdict as string) ?? "";
      if (verdict) verdictsByDate[dateKey].push(verdict);
      const eff = (raw.efficiency as Record<string, unknown>)?.score as number | undefined;
      if (typeof eff === "number") efficiencyScores.push(eff);
    } catch {
      if (r.verdict) verdictsByDate[dateKey].push(r.verdict);
    }
  }

  const productiveDays: string[] = [];
  for (const [date, verdicts] of Object.entries(verdictsByDate)) {
    if (verdicts.includes("productive")) productiveDays.push(date);
  }
  productiveDays.sort((a, b) => (b > a ? 1 : -1));

  let currentStreak = 0;
  let bestStreak = 0;
  if (productiveDays.length > 0) {
    let streak = 1;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (productiveDays[0] === today || productiveDays[0] === yesterday) {
      for (let i = 1; i < productiveDays.length; i++) {
        const prev = new Date(productiveDays[i - 1]);
        const curr = new Date(productiveDays[i]);
        const diff = (prev.getTime() - curr.getTime()) / 86400000;
        if (diff <= 1.5) streak++;
        else break;
      }
      currentStreak = streak;
    }
    streak = 1;
    bestStreak = 1;
    for (let i = 1; i < productiveDays.length; i++) {
      const prev = new Date(productiveDays[i - 1]);
      const curr = new Date(productiveDays[i]);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff <= 1.5) { streak++; bestStreak = Math.max(bestStreak, streak); }
      else streak = 1;
    }
  }

  const totalProductiveSessions = records.filter((r) => r.verdict === "productive").length;
  const productiveRate = analyzedCount > 0
    ? Math.round((totalProductiveSessions / analyzedCount) * 100) : 0;
  const avgEfficiency = efficiencyScores.length > 0
    ? Math.round((efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length) * 10) / 10 : 0;
  const totalToolCalls = records.reduce((sum, r) => sum + r.totalCalls, 0);
  const uniqueSkills = new Set(records.flatMap((r) => r.skills)).size;
  const avgTurns = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.userTurns + r.assistantTurns, 0) / records.length) : 0;

  const activityMap: Record<string, number> = {};
  for (const r of records) {
    const dateKey = r.timestamp ? r.timestamp.slice(0, 10) : r.date;
    if (!dateKey) continue;
    activityMap[dateKey] = (activityMap[dateKey] ?? 0) + 1;
  }

  const day = 86400000;
  const now = Date.now();
  const recentCutoff = new Date(now - 30 * day).toISOString().slice(0, 10);
  const olderCutoff = new Date(now - 60 * day).toISOString().slice(0, 10);

  const recent = records.filter((r) => (r.timestamp || r.date) >= recentCutoff);
  const older = records.filter((r) => {
    const d = r.timestamp || r.date;
    return d >= olderCutoff && d < recentCutoff;
  });

  const recentProdRate = recent.length > 0
    ? recent.filter((r) => r.verdict === "productive").length / recent.length : 0;
  const olderProdRate = older.length > 0
    ? older.filter((r) => r.verdict === "productive").length / older.length : 0;
  const recentToolAvg = recent.length > 0
    ? recent.reduce((s, r) => s + r.totalCalls, 0) / recent.length : 0;
  const olderToolAvg = older.length > 0
    ? older.reduce((s, r) => s + r.totalCalls, 0) / older.length : 0;

  return {
    totalSessions: records.length,
    analyzedSessions: analyzedCount,
    productiveRate,
    avgEfficiency,
    currentStreak,
    bestStreak,
    totalToolCalls,
    uniqueSkills,
    avgTurns,
    activityMap,
    trends: {
      productiveRate: computeTrend(recentProdRate, olderProdRate),
      efficiency: computeTrend(avgEfficiency, avgEfficiency),
      toolCalls: computeTrend(recentToolAvg, olderToolAvg),
    },
  };
}

export function registerStatsRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/stats", async () => {
    return loadStatsOverview(root) ?? {};
  });
}
