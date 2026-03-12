import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { spawnSession, connectSession, listSessions, killSession, getInfo, setSessionLabel } from "./manager.js";
import { logSessionStarted, tapSession } from "./session-logger.js";
import { generateName } from "./namer.js";

export function registerTerminalRoutes(app: FastifyInstance): void {
  app.post<{
    Body: {
      command?: string;
      args?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
    };
  }>("/api/terminal", async (req) => {
    const { command, args, cwd, cols, rows } = req.body ?? {};
    const session = await spawnSession({ command, args, cwd, cols, rows });
    logSessionStarted(session);

    // Open a dedicated tap connection for logging/MQTT (independent of WebSocket clients)
    const tap = await connectSession(session.id);
    if (tap) tapSession(session.id, tap);

    // Fire-and-forget: generate a creative label
    generateName(session.command, session.cwd).then((label) => {
      setSessionLabel(session.id, label);
    }).catch(() => {});

    return session;
  });

  app.get("/api/terminal", async () => listSessions());

  app.get<{ Params: { id: string } }>(
    "/api/terminal/:id",
    async (req, reply) => {
      const info = getInfo(req.params.id);
      if (!info) return reply.code(404).send({ error: "Not found" });
      return info;
    },
  );

  app.patch<{ Params: { id: string }; Body: { label: string } }>(
    "/api/terminal/:id/label",
    async (req, reply) => {
      const { label } = req.body ?? {};
      if (!label) return reply.code(400).send({ error: "Missing label" });
      const ok = setSessionLabel(req.params.id, label);
      if (!ok) return reply.code(404).send({ error: "Not found" });
      return { ok: true, label };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/terminal/:id",
    async (req, reply) => {
      const ok = killSession(req.params.id);
      reply.code(ok ? 200 : 404).send({ killed: ok });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/ws/terminal/:id",
    { websocket: true },
    async (socket: WebSocket, req) => {
      const proc = await connectSession(req.params.id);
      if (!proc) {
        socket.send(JSON.stringify({ type: "error", message: "Session not found" }));
        socket.close();
        return;
      }

      const dataDisposable = proc.onData((data: string) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: "output", data }));
        }
      });

      const exitDisposable = proc.onExit(({ exitCode }) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: "exit", code: exitCode }));
        }
      });

      socket.on("message", (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
          if (msg.type === "input" && typeof msg.data === "string") {
            proc.write(msg.data);
          } else if (msg.type === "resize" && msg.cols && msg.rows) {
            proc.resize(Number(msg.cols), Number(msg.rows));
          }
        } catch {
          proc.write(typeof raw === "string" ? raw : raw.toString());
        }
      });

      socket.on("close", () => {
        dataDisposable.dispose();
        exitDisposable.dispose();
        proc.disconnect();
      });
    },
  );
}
