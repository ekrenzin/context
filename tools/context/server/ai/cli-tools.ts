import { execFileSync, execSync, spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface CliToolStatus {
  installed: boolean;
  version: string | null;
}

/** Resolve the user's full PATH by sourcing their login shell. */
function resolveShellPath(): string {
  try {
    const shell = process.env.SHELL ?? "/bin/zsh";
    const out = execSync(`${shell} -ilc 'echo $PATH'`, {
      stdio: "pipe",
      timeout: 5_000,
    }).toString().trim();
    return out;
  } catch {
    return process.env.PATH ?? "";
  }
}

let cachedPath: string | null = null;
function shellPath(): string {
  if (cachedPath === null) {
    cachedPath = resolveShellPath();
  }
  return cachedPath;
}

function whichSync(bin: string): string | null {
  // Try the standard which first with the server's PATH
  try {
    return execFileSync("which", [bin], { stdio: "pipe" }).toString().trim();
  } catch { /* continue */ }

  // Check common install locations directly
  const home = homedir();
  const candidates = [
    join(home, ".npm-global", "bin", bin),
    join(home, ".local", "bin", bin),
    "/usr/local/bin/" + bin,
    "/opt/homebrew/bin/" + bin,
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fall back to the user's full shell PATH
  try {
    return execFileSync("which", [bin], {
      stdio: "pipe",
      env: { ...process.env, PATH: shellPath() },
    }).toString().trim();
  } catch {
    return null;
  }
}

function versionSync(bin: string): string | null {
  const env = { ...process.env, PATH: shellPath() };
  try {
    const out = execFileSync(bin, ["--version"], {
      stdio: "pipe",
      env,
      timeout: 5_000,
    }).toString();
    const match = out.match(/[\d.]+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export function claudeCliStatus(): CliToolStatus {
  const installed = whichSync("claude") !== null;
  return { installed, version: installed ? versionSync("claude") : null };
}

export function codexCliStatus(): CliToolStatus {
  const installed = whichSync("codex") !== null;
  return { installed, version: installed ? versionSync("codex") : null };
}

export function cloudflaredCliStatus(): CliToolStatus {
  const installed = whichSync("cloudflared") !== null;
  return { installed, version: installed ? versionSync("cloudflared") : null };
}

/** Install cloudflared via brew (macOS) or npm fallback. */
export function installCloudflared(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Try brew first on macOS, fall back to npm
    const isMac = process.platform === "darwin";
    const cmd = isMac ? "brew" : "npm";
    const args = isMac
      ? ["install", "cloudflare/cloudflare/cloudflared"]
      : ["install", "-g", "cloudflared"];

    const child = spawn(cmd, args, { stdio: "pipe" });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (isMac) {
        // brew not available, try npm
        installNpmPackage("cloudflared").then(resolve);
        return;
      }
      resolve({ success: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else if (isMac) {
        // brew failed, try npm
        installNpmPackage("cloudflared").then(resolve);
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: "Installation timed out after 120s" });
    }, 120_000);
  });
}

export function installNpmPackage(
  pkg: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["install", "-g", pkg], { stdio: "pipe" });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: "Installation timed out after 120s" });
    }, 120_000);
  });
}
