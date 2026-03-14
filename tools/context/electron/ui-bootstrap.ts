import { execSync, spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { parse as parseYaml } from "./yaml-lite.js";

export interface UiBootstrapResult {
  ready: boolean;
  uiDir: string;
  viteProcess: ChildProcess | null;
  error: string | null;
}

const UI_REPO = "https://github.com/ekrenzin/context-ui.git";
const UI_DIRNAME = "context-ui";
const VITE_PORT = 19471;

/** Read workspace.yaml and resolve the UI source directory. */
function resolveUiDir(workspaceRoot: string): string {
  const wsFile = path.join(workspaceRoot, "workspace.yaml");
  if (existsSync(wsFile)) {
    const raw = readFileSync(wsFile, "utf-8");
    const ws = parseYaml(raw);
    if (ws.uiSource) {
      return path.resolve(workspaceRoot, ws.uiSource);
    }
  }
  return path.join(workspaceRoot, "repos", UI_DIRNAME);
}

/** Check if the UI directory has a valid package.json. */
function isUiPresent(uiDir: string): boolean {
  return existsSync(path.join(uiDir, "package.json"));
}

/** Check if node_modules exists. */
function hasDeps(uiDir: string): boolean {
  return existsSync(path.join(uiDir, "node_modules"));
}

/** Clone the UI repo. Returns true on success. */
function cloneUi(uiDir: string): boolean {
  const parent = path.dirname(uiDir);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  try {
    execSync(`git clone --depth 1 ${UI_REPO} "${uiDir}"`, {
      stdio: "pipe",
      timeout: 60_000,
    });
    return true;
  } catch (err) {
    console.error("[ui-bootstrap] clone failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Install npm dependencies. Returns true on success. */
function installDeps(uiDir: string): boolean {
  try {
    execSync("npm install --production=false", {
      cwd: uiDir,
      stdio: "pipe",
      timeout: 120_000,
    });
    return true;
  } catch (err) {
    console.error("[ui-bootstrap] npm install failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Pull latest from upstream (fast-forward only). Returns true on success. */
function pullUpdates(uiDir: string): boolean {
  try {
    execSync("git pull --ff-only", {
      cwd: uiDir,
      stdio: "pipe",
      timeout: 30_000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Re-clone the UI repo from scratch (destructive reset). */
function resetUi(uiDir: string): boolean {
  try {
    execSync(`rm -rf "${uiDir}"`, { stdio: "pipe", timeout: 15_000 });
  } catch {
    return false;
  }
  return cloneUi(uiDir) && installDeps(uiDir);
}

/** Start the Vite dev server. Returns the child process. */
function startVite(uiDir: string): ChildProcess {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "--port", String(VITE_PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: uiDir,
    stdio: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  child.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[ui-vite] ${line}`);
  });
  child.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.error(`[ui-vite] ${line}`);
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[ui-vite] exited with code ${code}`);
    }
  });

  return child;
}

/** Wait for Vite to respond on its port. */
async function waitForVite(timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://127.0.0.1:${VITE_PORT}`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

/**
 * Ensure the UI is ready to serve. This is the main entry point.
 *
 * Sequence:
 * 1. Resolve UI directory from workspace.yaml
 * 2. If UI dir missing: clone it
 * 3. If deps missing: install them
 * 4. Start Vite dev server
 * 5. Wait for Vite to respond
 * 6. If anything fails: attempt reset and retry once
 */
export async function ensureUi(
  workspaceRoot: string,
  onProgress?: (message: string) => void,
): Promise<UiBootstrapResult> {
  const report = (msg: string) => {
    console.log(`[ui-bootstrap] ${msg}`);
    onProgress?.(msg);
  };

  const uiDir = resolveUiDir(workspaceRoot);
  report(`UI directory: ${uiDir}`);

  // Step 1: Ensure UI source exists
  if (!isUiPresent(uiDir)) {
    report("UI not found, cloning...");
    if (!cloneUi(uiDir)) {
      return { ready: false, uiDir, viteProcess: null, error: "Failed to clone UI repository. Check network connection." };
    }
    report("Clone complete.");
  }

  // Step 2: Ensure dependencies
  if (!hasDeps(uiDir)) {
    report("Installing dependencies...");
    if (!installDeps(uiDir)) {
      return { ready: false, uiDir, viteProcess: null, error: "Failed to install UI dependencies." };
    }
    report("Dependencies installed.");
  }

  // Step 3: Start Vite
  report("Starting UI server...");
  let viteProcess = startVite(uiDir);

  // Step 4: Wait for Vite
  const viteReady = await waitForVite();
  if (viteReady) {
    report("UI ready.");
    return { ready: true, uiDir, viteProcess, error: null };
  }

  // Step 5: Vite failed -- try reset and retry
  report("UI server failed to start. Attempting repair...");
  viteProcess.kill("SIGTERM");

  if (resetUi(uiDir)) {
    report("Reset complete, retrying...");
    viteProcess = startVite(uiDir);
    const retryReady = await waitForVite();
    if (retryReady) {
      report("UI ready after repair.");
      return { ready: true, uiDir, viteProcess, error: null };
    }
  }

  viteProcess.kill("SIGTERM");
  return {
    ready: false,
    uiDir,
    viteProcess: null,
    error: "UI failed to start after repair attempt. Try resetting manually.",
  };
}

/** Attempt a git pull to update the UI. Returns status. */
export async function updateUi(workspaceRoot: string): Promise<{
  updated: boolean;
  error?: string;
}> {
  const uiDir = resolveUiDir(workspaceRoot);
  if (!isUiPresent(uiDir)) {
    return { updated: false, error: "UI not found" };
  }

  if (!pullUpdates(uiDir)) {
    return { updated: false, error: "Pull failed (conflicts or no network)" };
  }

  if (!installDeps(uiDir)) {
    return { updated: false, error: "Dependency install failed after update" };
  }

  return { updated: true };
}

/** Hard reset the UI to upstream defaults. */
export async function resetUiToDefaults(workspaceRoot: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const uiDir = resolveUiDir(workspaceRoot);
  const success = resetUi(uiDir);
  return success
    ? { success: true }
    : { success: false, error: "Failed to reset UI" };
}

export { VITE_PORT };
