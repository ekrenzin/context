import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import type { FastifyInstance } from "fastify";

export interface SessionLogMeta {
  id: string;
  command?: string;
  cwd?: string;
  startedAt?: string;
  exitCode?: number;
  lineCount: number;
  sizeBytes: number;
}

function sessionsDir(root: string): string {
  return path.join(root, "memory", "sessions");
}

function metaPath(dir: string, id: string): string {
  return path.join(dir, `${id}.meta.json`);
}

function logPath(dir: string, id: string): string {
  return path.join(dir, `${id}.jsonl`);
}

// ── Metadata helpers ──────────────────────────────────────────────────

export function writeSessionMeta(root: string, meta: SessionLogMeta): void {
  const dir = sessionsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath(dir, meta.id), JSON.stringify(meta) + "\n");
}

export function updateSessionMeta(
  root: string,
  id: string,
  patch: Partial<SessionLogMeta>,
): void {
  const dir = sessionsDir(root);
  const mp = metaPath(dir, id);
  if (!fs.existsSync(mp)) return;
  try {
    const existing = JSON.parse(fs.readFileSync(mp, "utf-8")) as SessionLogMeta;
    fs.writeFileSync(mp, JSON.stringify({ ...existing, ...patch }) + "\n");
  } catch {
    // corrupt meta, ignore
  }
}

/**
 * List sessions by reading only the small .meta.json sidecar files.
 * Falls back to scanning JSONL headers for sessions without metadata.
 */
function listSessionLogs(root: string): SessionLogMeta[] {
  const dir = sessionsDir(root);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const results: SessionLogMeta[] = [];

  for (const f of files) {
    const id = f.replace(".jsonl", "");
    const mp = metaPath(dir, id);
    const lp = logPath(dir, id);

    if (fs.existsSync(mp)) {
      try {
        const meta = JSON.parse(fs.readFileSync(mp, "utf-8")) as SessionLogMeta;
        // Refresh size from actual file
        const stat = fs.statSync(lp);
        meta.sizeBytes = stat.size;
        results.push(meta);
        continue;
      } catch {
        // fall through to backfill
      }
    }

    // Backfill: extract metadata from first + last lines of JSONL
    results.push(backfillMeta(dir, id));
  }

  return results.sort((a, b) => (b.startedAt! > a.startedAt! ? 1 : -1));
}

/**
 * Read only the first and last few lines of a JSONL file to extract metadata.
 * Much faster than reading the entire multi-GB file.
 */
function backfillMeta(dir: string, id: string): SessionLogMeta {
  const lp = logPath(dir, id);
  const stat = fs.statSync(lp);
  const meta: SessionLogMeta = {
    id,
    lineCount: 0,
    sizeBytes: stat.size,
    startedAt: stat.birthtime.toISOString(),
  };

  // Read first 8KB for the "started" entry
  const headBuf = Buffer.alloc(Math.min(8192, stat.size));
  const fd = fs.openSync(lp, "r");
  try {
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    const headLines = headBuf.toString("utf-8").split("\n").filter((l) => l.trim());
    for (const line of headLines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "started") {
          meta.command = entry.command;
          meta.cwd = entry.cwd;
          meta.startedAt = entry.ts;
          break;
        }
      } catch {
        break; // partial line
      }
    }

    // Read last 4KB for the "exited" entry
    if (stat.size > 4096) {
      const tailBuf = Buffer.alloc(4096);
      fs.readSync(fd, tailBuf, 0, tailBuf.length, stat.size - 4096);
      const tailLines = tailBuf.toString("utf-8").split("\n").filter((l) => l.trim());
      for (const line of tailLines.reverse()) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "exited") {
            meta.exitCode = entry.exitCode;
            break;
          }
        } catch {
          continue; // partial line at buffer boundary
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  // Write the sidecar so next time is instant
  try {
    fs.writeFileSync(metaPath(dir, id), JSON.stringify(meta) + "\n");
  } catch {
    // non-critical
  }

  return meta;
}

// ── Routes ────────────────────────────────────────────────────────────

export function registerSessionLogRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/session-logs", async () => listSessionLogs(root));

  // Stream JSONL content for incremental rendering (register before /:id)
  app.get<{ Params: { id: string } }>(
    "/api/session-logs/:id/stream",
    async (req, reply) => {
      const filePath = logPath(sessionsDir(root), req.params.id);
      if (!fs.existsSync(filePath)) {
        reply.code(404).send({ error: "Session log not found" });
        return;
      }

      reply.raw.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      });

      const stream = createReadStream(filePath, { encoding: "utf-8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        reply.raw.write(line + "\n");
      }

      reply.raw.end();
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/session-logs/:id",
    async (req, reply) => {
      const filePath = logPath(sessionsDir(root), req.params.id);
      if (!fs.existsSync(filePath)) {
        reply.code(404).send({ error: "Session log not found" });
        return;
      }

      const stream = createReadStream(filePath, { encoding: "utf-8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      const entries: unknown[] = [];

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          entries.push(JSON.parse(line));
        } catch {
          // skip malformed lines
        }
      }

      return { entries };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/session-logs/:id",
    async (req, reply) => {
      const dir = sessionsDir(root);
      const id = req.params.id;
      try {
        fs.unlinkSync(logPath(dir, id));
      } catch {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      // Clean up sidecar
      try { fs.unlinkSync(metaPath(dir, id)); } catch {}
      reply.send({ deleted: true });
    },
  );
}
