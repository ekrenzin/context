import { execFile } from "child_process";
import os from "os";
import type { LaunchResult } from "./types.js";
import { spawnSession, type SessionInfo } from "../terminal/manager.js";

export interface LaunchOutcome {
  method: "opened" | "session";
  label: string;
  sessionId?: string;
}

const APP_NAMES: Record<string, string> = {
  cursor: "Cursor",
  windsurf: "Windsurf",
};

function loginShell(): string {
  if (os.platform() === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/zsh";
}

function openGuiIde(ideName: string, rootPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const appName = APP_NAMES[ideName];
    if (process.platform === "darwin" && appName) {
      execFile("open", ["-a", appName, rootPath], (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      execFile(ideName, [rootPath], (err) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

export async function executeLaunch(
  ideName: string,
  result: LaunchResult,
  root?: string,
): Promise<LaunchOutcome> {
  if (result.method === "open") {
    await openGuiIde(ideName, result.value);
    return { method: "opened", label: result.label };
  }

  if (result.method === "pty" && root) {
    const shell = loginShell();
    const cmdArgs = result.args ?? [];
    const fullCmd = [result.value, ...cmdArgs].map(shellEscape).join(" ");
    const session: SessionInfo = await spawnSession({
      command: shell,
      args: ["-l", "-c", fullCmd],
      cwd: root,
    });
    return { method: "session", label: result.label, sessionId: session.id };
  }

  return { method: "opened", label: result.label };
}

function shellEscape(s: string): string {
  if (/^[a-zA-Z0-9._\-/=:]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}
