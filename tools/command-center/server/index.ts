import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes/index.js";
import { createWatchers } from "./watchers.js";
import { createManager } from "./manager.js";
import { createMqttClient, ensureBroker, stopBroker } from "ctx-mqtt";
import { createAgentScheduler } from "./agent-scheduler.js";
import { createUpdateChecker } from "./update-checker.js";
import { createMcpServer, registerMcpRoutes } from "./mcp/index.js";
import { openDb, closeDb, migrate } from "./db/index.js";
import { ensureAuthToken } from "./auth/index.js";
import { registerAuthHook, setServerToken } from "./auth/index.js";
import { importMarkdownMemory } from "./memory/import.js";
import { registerTerminalRoutes } from "./terminal/routes.js";
import { closeAll as closeTerminals, restoreSessions } from "./terminal/manager.js";
import { initSessionLogger } from "./terminal/session-logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.CTX_DASHBOARD_PORT ?? "19470", 10);
const ROOT = process.env.CTX_ROOT ?? path.resolve(__dirname, "..", "..");

function ensureCtxEnv(): void {
  const isWin = process.platform === "win32";
  const ctxBin = isWin
    ? path.join(ROOT, "tools", ".venv", "Scripts", "ctx.exe")
    : path.join(ROOT, "tools", ".venv", "bin", "ctx");

  if (fs.existsSync(ctxBin)) return;

  const bootstrap = path.join(ROOT, "tools", "bootstrap.py");
  if (!fs.existsSync(bootstrap)) {
    console.warn("[ctx-env] bootstrap.py not found -- skipping auto-setup");
    return;
  }

  const python = isWin ? "python" : "python3";
  console.log("[ctx-env] CLI not found -- running bootstrap...");
  try {
    execFileSync(python, [bootstrap], {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log("[ctx-env] bootstrap complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ctx-env] bootstrap failed: ${msg}`);
    console.warn("[ctx-env] agent scheduler jobs will not work until fixed");
  }
}

function resolveCursorProjectDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const base = path.join(home, ".cursor", "projects");
  try {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.includes("context")) {
        return path.join(base, entry.name);
      }
    }
    if (entries.length > 0) {
      return path.join(base, entries[0].name);
    }
  } catch {
    /* fallback */
  }
  return base;
}

export async function start(): Promise<void> {
  ensureCtxEnv();

  const db = openDb(ROOT);
  const { applied } = migrate(db);
  if (applied.length) {
    console.log(`[db] applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }

  const appUrl = `http://127.0.0.1:${PORT}`;
  const authToken = ensureAuthToken(appUrl);
  setServerToken(authToken);

  const memImport = importMarkdownMemory(ROOT);
  if (memImport.imported > 0) {
    console.log(`[memory] imported ${memImport.imported} entries from markdown`);
  }

  await ensureBroker(ROOT);

  const app = Fastify({ logger: false });
  await app.register(websocket);
  registerAuthHook(app);
  const mqttClient = createMqttClient();

  const manager = createManager(mqttClient);
  const watchers = createWatchers(ROOT, manager);

  const cursorProjectDir = resolveCursorProjectDir();
  const transcriptDir = path.join(cursorProjectDir, "agent-transcripts");

  const scheduler = createAgentScheduler(ROOT, transcriptDir, manager);
  const updateChecker = createUpdateChecker(ROOT, manager);

  registerRoutes(app, ROOT, scheduler, transcriptDir, updateChecker, mqttClient);
  registerTerminalRoutes(app);
  initSessionLogger(mqttClient, ROOT);

  const restoredCount = await restoreSessions();
  if (restoredCount > 0) {
    console.log(`[terminal] restored ${restoredCount} session(s) from previous run`);
  }

  const mcp = createMcpServer({ scheduler, mqttClient, updateChecker, root: ROOT });
  registerMcpRoutes(app, mcp);

  const isCompiledRun = __dirname.includes(path.sep + "dist" + path.sep);
  const distWeb = isCompiledRun
    ? path.resolve(__dirname, "..", "web")
    : path.resolve(__dirname, "..", "dist", "web");
  try {
    await app.register(fastifyStatic, {
      root: distWeb,
      prefix: "/",
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/ws")) {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      reply.sendFile("index.html", distWeb);
    });
  } catch {
    // Dev mode -- Vite serves the frontend
  }

  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`Context Dashboard server listening on http://127.0.0.1:${PORT}`);

  scheduler.start();
  updateChecker.start();

  async function shutdown() {
    closeTerminals();
    updateChecker.stop();
    scheduler.stop();
    watchers.close();
    manager.close();
    await mqttClient.close();
    stopBroker();
    await app.close();
    closeDb();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  start().catch((err) => {
    console.error("Failed to start dashboard server:", err);
    process.exit(1);
  });
}
