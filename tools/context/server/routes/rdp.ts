import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  createSession,
  connectSession,
  listSessions,
  getSession,
  killSession,
  restoreSessions,
  closeAll,
} from "../rdp/manager.js";

export async function registerRdpRoutes(app: FastifyInstance): Promise<void> {
  // Restore sessions from previous server run
  const restored = await restoreSessions();
  if (restored > 0) console.log(`[rdp] restored ${restored} session(s)`);

  // Create session: parse config, spawn bridge, return session info
  app.post<{
    Body: { config: string; password?: string; width?: number; height?: number };
  }>("/api/rdp", async (req, reply) => {
    const { config, password, width, height } = req.body ?? {};
    if (!config) return reply.code(400).send({ error: "Missing config" });

    try {
      const info = await createSession(
        { config, password, width, height },
        (phase: string, message: string) => {
          console.log(`[rdp] ${phase}: ${message}`);
        },
      );
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });

  app.get("/api/rdp", async () => listSessions());

  app.get<{ Params: { id: string } }>("/api/rdp/:id", async (req, reply) => {
    const info = getSession(req.params.id);
    if (!info) return reply.code(404).send({ error: "Session not found" });
    return info;
  });

  app.delete<{ Params: { id: string } }>("/api/rdp/:id", async (req, reply) => {
    const ok = killSession(req.params.id);
    if (!ok) return reply.code(404).send({ deleted: false });
    return { deleted: true };
  });

  // WebSocket: connect to existing bridge socket, relay bidirectionally
  app.get<{ Params: { id: string } }>(
    "/ws/rdp/:id",
    { websocket: true },
    async (socket: WebSocket, req) => {
      const id = req.params.id;
      const info = getSession(id);
      if (!info) {
        socket.send(JSON.stringify({ type: "error", message: "Session not found" }));
        socket.close();
        return;
      }

      if (!info.bridgeAlive) {
        socket.send(JSON.stringify({ type: "error", message: "Bridge is not running" }));
        socket.close();
        return;
      }

      socket.send(JSON.stringify({ type: "status", phase: "attaching", message: "Connecting to bridge..." }));

      let bridge;
      try {
        bridge = await connectSession(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        socket.send(JSON.stringify({ type: "error", message: msg }));
        socket.close();
        return;
      }

      if (!bridge) {
        socket.send(JSON.stringify({ type: "error", message: "Bridge connection failed" }));
        socket.close();
        return;
      }

      // Bridge -> browser
      const unsub = bridge.onData((msg: unknown) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(msg));
        }
      });

      // Browser -> bridge
      let inputCount = 0;
      socket.on("message", (raw: Buffer | string) => {
        try {
          const text = typeof raw === "string" ? raw : raw.toString("utf-8");
          const msg = JSON.parse(text);
          if (msg.type === "mouse" && msg.button !== "move") {
            inputCount++;
            if (inputCount <= 5) console.log(`[rdp] relay click #${inputCount}: ${msg.button} (${msg.x},${msg.y}) bridge.connected=${bridge.connected}`);
          }
          bridge.send(msg);
        } catch { /* ignore */ }
      });

      socket.on("close", () => {
        unsub();
        bridge.disconnect();
        // Bridge stays alive -- that is the whole point
      });
    },
  );
}

export function closeRdpSessions(): void {
  closeAll();
}
