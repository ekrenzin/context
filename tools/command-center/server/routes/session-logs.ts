import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";

interface SessionLogMeta {
  id: string;
  command?: string;
  cwd?: string;
  startedAt?: string;
  exitCode?: number;
  lineCount: number;
  sizeBytes: number;
}

interface SessionLogLine {
  ts: string;
  type: "started" | "output" | "exited";
  data?: string;
  command?: string;
  cwd?: string;
  exitCode?: number;
}

function sessionsDir(root: string): string {
  return path.join(root, "memory", "sessions");
}

function listSessionLogs(root: string): SessionLogMeta[] {
  const dir = sessionsDir(root);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      let command: string | undefined;
      let cwd: string | undefined;
      let startedAt: string | undefined;
      let exitCode: number | undefined;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as SessionLogLine;
          if (entry.type === "started") {
            command = entry.command;
            cwd = entry.cwd;
            startedAt = entry.ts;
          }
          if (entry.type === "exited") {
            exitCode = entry.exitCode;
          }
        } catch {}
      }

      return {
        id: f.replace(".jsonl", ""),
        command,
        cwd,
        startedAt: startedAt ?? stat.birthtime.toISOString(),
        exitCode,
        lineCount: lines.length,
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => (b.startedAt! > a.startedAt! ? 1 : -1));
}

function readSessionLog(root: string, id: string): SessionLogLine[] {
  const filePath = path.join(sessionsDir(root), `${id}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as SessionLogLine;
      } catch {
        return null;
      }
    })
    .filter((e): e is SessionLogLine => e !== null);
}

export function registerSessionLogRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/session-logs", async () => listSessionLogs(root));

  app.get<{ Params: { id: string } }>(
    "/api/session-logs/:id",
    async (req, reply) => {
      const entries = readSessionLog(root, req.params.id);
      if (entries.length === 0) {
        reply.code(404).send({ error: "Session log not found" });
        return;
      }
      return { entries };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/session-logs/:id",
    async (req, reply) => {
      const filePath = path.join(sessionsDir(root), `${req.params.id}.jsonl`);
      try {
        fs.unlinkSync(filePath);
        reply.send({ deleted: true });
      } catch {
        reply.code(404).send({ error: "Not found" });
      }
    },
  );
}
