import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from "electron";
import { spawn, execSync, ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.CTX_DASHBOARD_PORT ?? "19470", 10);
const VITE_PORT = 19471;
const USE_VITE = !!process.env.CTX_VITE || !!process.env.CTX_DEV;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;

function killExistingInstances(): void {
  try {
    const appName = "Electron";
    // Find other Electron processes running from this project's node_modules
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
      // Give the old process a moment to release the lock
      execSync("sleep 1");
    }
  } catch {
    // pgrep returns non-zero when no matches — that's fine
  }
}

function enforceSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log("[electron] Lock held by another instance — killing it and retrying…");
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

function resolveCommandCenterRoot(): string {
  // dist/electron/ → command-center root (compiled)
  // electron/ → command-center root (source, unused today)
  return path.resolve(__dirname, "..", "..");
}

async function ensureServer(): Promise<void> {
  if (await isServerReady()) return;

  const ccRoot = resolveCommandCenterRoot();
  const ctxRoot = path.resolve(ccRoot, "..", "..");

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

  const url = USE_VITE ? `http://127.0.0.1:${VITE_PORT}` : `http://127.0.0.1:${PORT}`;

  // Retry loading until the dev server is ready (Vite may start after Electron)
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
  };
  loadWithRetry();

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

  ipcMain.handle("pick-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose workspace location",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  await ensureServer();
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
  killServer();
});
