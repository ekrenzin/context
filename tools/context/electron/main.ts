import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from "electron";
import { spawn, execSync, ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureUi, updateUi, resetUiToDefaults, VITE_PORT, type UiBootstrapResult } from "./ui-bootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.CTX_DASHBOARD_PORT ?? "19470", 10);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let uiResult: UiBootstrapResult | null = null;

function resolveCommandCenterRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

function resolveWorkspaceRoot(): string {
  const ccRoot = resolveCommandCenterRoot();
  return path.resolve(ccRoot, "..", "..");
}

function killExistingInstances(): void {
  try {
    const ccRoot = resolveCommandCenterRoot();
    const result = execSync(`pgrep -f "${ccRoot}/node_modules/electron"`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    const myPid = process.pid;
    const pids = result
      .split("\n")
      .map((p) => parseInt(p, 10))
      .filter((p) => !isNaN(p) && p !== myPid);

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }

    if (pids.length > 0) {
      execSync("sleep 1");
    }
  } catch {
    // pgrep returns non-zero when no matches
  }
}

function enforceSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log("[electron] Lock held by another instance -- killing it and retrying...");
    killExistingInstances();

    const retryLock = app.requestSingleInstanceLock();
    if (!retryLock) {
      console.error("[electron] Still cannot acquire lock after killing old instance. Exiting.");
      app.quit();
      return false;
    }
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  return true;
}

async function isServerReady(): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/stats`);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

async function ensureServer(): Promise<void> {
  if (await isServerReady()) return;

  const ccRoot = resolveCommandCenterRoot();
  const ctxRoot = resolveWorkspaceRoot();

  const tsx = path.join(ccRoot, "node_modules", ".bin", "tsx");
  const tsSource = path.join(ccRoot, "server", "index.ts");
  const jsCompiled = path.join(ccRoot, "dist", "server", "index.js");

  const useTsx = existsSync(tsx) && existsSync(tsSource);
  const cmd = useTsx ? tsx : "node";
  const script = useTsx ? tsSource : jsCompiled;

  console.log(`[electron] Starting server via ${useTsx ? "tsx" : "node"}`);

  serverProcess = spawn(cmd, [script], {
    env: { ...process.env, CTX_ROOT: ctxRoot },
    stdio: "inherit",
    cwd: ccRoot,
  });

  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[electron] Server exited with code ${code}`);
    }
    serverProcess = null;
  });

  await waitForServer();
}

function killServer(): void {
  if (!serverProcess) return;
  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

function killUi(): void {
  if (uiResult?.viteProcess) {
    uiResult.viteProcess.kill("SIGTERM");
    uiResult.viteProcess = null;
  }
}

function loadFallback(error: string): void {
  if (!mainWindow) return;
  const fallbackPath = path.join(__dirname, "fallback.html");
  if (existsSync(fallbackPath)) {
    mainWindow.loadFile(fallbackPath).then(() => {
      mainWindow?.webContents.executeJavaScript(
        `document.getElementById('error').textContent = ${JSON.stringify(error)};`,
      );
    });
  } else {
    // Inline minimal fallback if the HTML file is missing
    mainWindow.loadURL(`data:text/html,<html><body style="background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div><h1>UI Error</h1><p>${error}</p></div></body></html>`);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Context",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (uiResult?.ready) {
    const url = `http://127.0.0.1:${VITE_PORT}`;
    const loadWithRetry = async (retries = 20, delayMs = 500) => {
      for (let i = 0; i < retries; i++) {
        try {
          await mainWindow!.loadURL(url);
          return;
        } catch {
          if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      console.error(`[electron] Failed to load ${url} after ${retries} attempts`);
      loadFallback("UI server started but failed to respond. Try restarting the app.");
    };
    loadWithRetry();
  } else {
    loadFallback(uiResult?.error ?? "UI could not be loaded.");
  }

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin") {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("Context");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(async () => {
  if (!enforceSingleInstance()) return;

  const wsRoot = resolveWorkspaceRoot();

  // IPC handlers
  ipcMain.handle("get-version", () => app.getVersion());

  ipcMain.handle("pick-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose workspace location",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("get-ui-error", () => uiResult?.error ?? null);

  ipcMain.handle("repair-ui", async () => {
    killUi();
    uiResult = await ensureUi(wsRoot);
    if (uiResult.ready) {
      mainWindow?.loadURL(`http://127.0.0.1:${VITE_PORT}`);
      return { success: true };
    }
    return { success: false, error: uiResult.error };
  });

  ipcMain.handle("reset-ui", async () => {
    killUi();
    const result = await resetUiToDefaults(wsRoot);
    if (result.success) {
      uiResult = await ensureUi(wsRoot);
      if (uiResult.ready) {
        mainWindow?.loadURL(`http://127.0.0.1:${VITE_PORT}`);
        return { success: true };
      }
    }
    return { success: false, error: result.error ?? uiResult?.error };
  });

  ipcMain.handle("update-ui", async () => {
    return updateUi(wsRoot);
  });

  // Boot sequence: server first, then UI, then window
  await ensureServer();
  uiResult = await ensureUi(wsRoot);
  createWindow();
  createTray();

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  killUi();
  killServer();
});
