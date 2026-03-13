import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { TunnelState } from "../types.js";

export function readTunnelState(root: string): TunnelState {
  const statePath = path.join(root, "playground", "output", "tunnel-state.json");
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const state: TunnelState = JSON.parse(raw);
    for (const inst of Object.values(state.tunnels ?? {})) {
      try {
        process.kill(inst.pid, 0);
        inst.alive = true;
      } catch {
        inst.alive = false;
      }
    }
    return state;
  } catch {
    return { tunnels: {} };
  }
}

export function registerTunnelRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/tunnels", async () => {
    return readTunnelState(root);
  });
}
