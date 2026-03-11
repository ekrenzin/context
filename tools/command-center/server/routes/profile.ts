import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { ProfileData } from "../types.js";

export function loadProfile(root: string): ProfileData | null {
  try {
    const filePath = path.join(root, "memory", "profile", "agent-profile.json");
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const skills = Object.entries(raw.skills ?? {})
      .map(([name, v]) => {
        const val = v as { count: number; last_seen: string };
        return { name, count: val.count, lastSeen: val.last_seen };
      })
      .sort((a, b) => b.count - a.count);

    const tools = Object.entries(raw.tools ?? {})
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);

    const scanDate = raw.last_scan
      ? new Date(raw.last_scan as string).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : "unknown";

    return {
      skills,
      tools,
      lastScan: scanDate,
      sessions: (raw.transcripts_scanned as number) ?? 0,
    };
  } catch {
    return null;
  }
}

export function registerProfileRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/profile", async () => {
    return loadProfile(root) ?? { skills: [], tools: [], lastScan: "unknown", sessions: 0 };
  });
}
