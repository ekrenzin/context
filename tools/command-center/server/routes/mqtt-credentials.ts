import type { FastifyInstance } from "fastify";
import { readCredentials } from "ctx-mqtt";

export function registerMqttCredentialRoutes(app: FastifyInstance): void {
  app.get("/api/mqtt-credentials", async () => {
    const creds = readCredentials();
    if (!creds) {
      return { username: null, password: null, wsPort: 9001 };
    }
    return {
      username: creds.username,
      password: creds.password,
      wsPort: creds.wsPort,
    };
  });
}
