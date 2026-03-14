import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { execFileSync, execSync } from "child_process";
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
import { ToolCatalog } from "./ai/tool-catalog.js";
import { openDb, closeDb, migrate } from "./db/index.js";
import { ensureAuthToken } from "./auth/index.js";
import { registerAuthHook, setServerToken } from "./auth/index.js";
import { importMarkdownMemory } from "./memory/import.js";
import { registerTerminalRoutes } from "./terminal/routes.js";
import { registerRdpRoutes, closeRdpSessions } from "./routes/rdp.js";
import { closeAll as closeTerminals, restoreSessions } from "./terminal/manager.js";
import { initSessionLogger } from "./terminal/session-logger.js";
import { initTerminalBridge } from "./terminal/mqtt-bridge.js";
import { registerActionRoutes, initActionBridge } from "./terminal/action-routes.js";
import { createLocalAi } from "./ai/local-ai.js";
import { createAutoCommit } from "./auto-commit.js";
import { createMcpSync } from "./mcp-sync/index.js";
import { startRemoteBridge } from "./sync/remote-bridge.js";
import { startTunnelManager, registerTunnelRoutes } from "./tunnel/manager.js";
import { registerTunnelAuth } from "./tunnel/auth.js";
import { initBroadcastRelay } from "./terminal/broadcast-relay.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.CTX_DASHBOARD_PORT ?? "19470", 10);
const ROOT = process.env.CTX_ROOT ?? path.resolve(__dirname, "..", "..");

function ensureCtxEnv(): void {
  const isWin = process.platform === "win32";
  const ctxBin = isWin
    ? path.join(ROOT, "tools", ".venv", "Scripts", "ctx.exe")
    : path.join(ROOT, "tools", ".venv", "bin", "ctx");

  if (fs.existsSync(ctxBin)) {
    try {
      execFileSync(ctxBin, ["--help"], { timeout: 10_000, stdio: "ignore" });
      return;
    } catch {
      console.warn("[ctx-env] CLI exists but is broken -- rebuilding...");
    }
  }

  const bootstrap = path.join(ROOT, "tools", "bootstrap.py");
  if (!fs.existsSync(bootstrap)) {
    console.warn("[ctx-env] bootstrap.py not found -- skipping auto-setup");
    return;
  }

  const python = isWin ? "python" : "python3";
  console.log("[ctx-env] running bootstrap...");
  try {
    execFileSync(python, [bootstrap, "--force"], {
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

function killStaleServers(): void {
  try {
    const out = execSync("ps -eo pid,command", { encoding: "utf-8" });
    const myPid = process.pid;
    const parentPid = process.ppid;
    for (const line of out.split("\n")) {
      if (!line.includes("server/index.ts")) continue;
      const pid = parseInt(line.trim(), 10);
      if (isNaN(pid) || pid === myPid || pid === parentPid) continue;
      try {
        process.kill(pid, "SIGTERM");
        console.log(`[server] killed stale server process ${pid}`);
      } catch {
        // already dead
      }
    }
  } catch {
    // ps not available or failed -- not critical
  }
}

export async function start(): Promise<void> {
  killStaleServers();
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
  const localAi = createLocalAi(mqttClient);
  const autoCommit = createAutoCommit(ROOT, mqttClient);
  const mcpSync = createMcpSync(ROOT, mqttClient);

  registerRoutes(app, ROOT, scheduler, transcriptDir, updateChecker, mqttClient, autoCommit, mcpSync);
  registerTerminalRoutes(app);
  registerRdpRoutes(app);
  registerActionRoutes(app);
  registerTunnelAuth(app, mqttClient);
  registerTunnelRoutes(app);
  initSessionLogger(mqttClient, ROOT);
  initTerminalBridge(mqttClient);
  initActionBridge(mqttClient);
  initBroadcastRelay(ROOT);

  const remoteBridge = startRemoteBridge();
  const tunnel = startTunnelManager();

  const restoredCount = await restoreSessions();
  if (restoredCount > 0) {
    console.log(`[terminal] restored ${restoredCount} session(s) from previous run`);
  }

  const mcpDeps = { scheduler, mqttClient, updateChecker, root: ROOT };
  const mcp = await createMcpServer(mcpDeps);
  registerMcpRoutes(app, mcp, mcpDeps);

  const toolCatalog = new ToolCatalog();
  toolCatalog.build(mcp);
  console.log(`[ai] tool catalog built with ${toolCatalog.size} tool(s)`);

  // Register AI chat routes now that catalog is ready
  const { registerAiChatRoutes } = await import("./routes/ai-chat.js");
  registerAiChatRoutes(app, toolCatalog);

  // Rebuild catalog on MCP reload
  mqttClient.subscribe("ctx/mcp/status", (payload: unknown) => {
    const msg = payload as { status?: string };
    if (msg?.status === "reloaded") {
      toolCatalog.build(mcp);
      console.log(`[ai] tool catalog rebuilt with ${toolCatalog.size} tool(s)`);
    }
  });

  // UI is served by Vite (dev) or from the external context-ui repo's dist/ (prod).
  // The Electron bootstrap handles starting Vite. The server only serves static
  // files as a fallback for non-Electron production deployments.
  const uiDist = path.resolve(ROOT, "repos", "context-ui", "dist");
  if (fs.existsSync(uiDist)) {
    try {
      await app.register(fastifyStatic, {
        root: uiDist,
        prefix: "/",
      });
      app.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith("/api/") || req.url.startsWith("/ws")) {
          reply.code(404).send({ error: "Not found" });
          return;
        }
        reply.sendFile("index.html", uiDist);
      });
    } catch {
      // Vite serves the frontend in dev mode
    }
  }

  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`Context Dashboard server listening on http://127.0.0.1:${PORT}`);

  scheduler.start();
  updateChecker.start();
  localAi.start();
  autoCommit.start();
  mcpSync.start();

  async function shutdown() {
    tunnel.stop();
    remoteBridge.stop();
    closeRdpSessions();
    closeTerminals();
    mcpSync.stop();
    autoCommit.stop();
    localAi.stop();
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
