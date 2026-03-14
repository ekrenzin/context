import type { FastifyInstance } from "fastify";
import { registerCloudflareRoutes } from "./cloudflare.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerCloudflareRoutes(app);
}
