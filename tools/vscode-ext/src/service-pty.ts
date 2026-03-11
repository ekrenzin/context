import * as vscode from "vscode";
import { spawn, type ChildProcess } from "child_process";

const LEVEL_NAMES: Record<number, string> = {
  10: "debug",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "error",
};

const LEVEL_STRINGS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  warning: 40,
  error: 50,
  fatal: 60,
};

function levelName(n: number): string {
  return LEVEL_NAMES[n] ?? (n >= 50 ? "error" : "info");
}

export interface LogEntry {
  level: number;
  levelName: string;
  time: number;
  msg: string;
  app: string;
  name: string;
  [key: string]: unknown;
}

export type OnLogLine = (entry: LogEntry) => void;

function appFromCwd(cwd: string): string {
  const reposMatch = cwd.match(/repos\/([^/]+)/);
  if (reposMatch) return reposMatch[1];
  if (cwd.includes("command-center")) return "command-center";
  return "unknown";
}

function parseLine(raw: string, app: string): LogEntry | null {
  const prefixMatch = raw.match(/^\[(?:LMB|\d+)\]\s*(.*)/);
  const json = prefixMatch ? prefixMatch[1] : raw;

  if (json.startsWith("{")) {
    try {
      const obj = JSON.parse(json);
      if (typeof obj.msg !== "string" && typeof obj.message !== "string") {
        return null;
      }
      const level =
        typeof obj.level === "number"
          ? obj.level
          : typeof obj.level === "string"
            ? (LEVEL_STRINGS[obj.level.toLowerCase()] ?? 30)
            : 30;
      return {
        ...obj,
        level,
        levelName: levelName(level),
        msg: obj.msg ?? obj.message,
        name: obj.name ?? app,
        app,
        time: obj.time ? new Date(obj.time).getTime() : Date.now(),
      };
    } catch {
      return null;
    }
  }

  return null;
}

function rawEntry(line: string, app: string, isStderr: boolean): LogEntry {
  const level = isStderr ? 50 : 30;
  return {
    level,
    levelName: levelName(level),
    time: Date.now(),
    msg: line,
    app,
    name: app,
  };
}

export class ServicePty implements vscode.Pseudoterminal {
  private _writeEmitter = new vscode.EventEmitter<string>();
  private _closeEmitter = new vscode.EventEmitter<number | void>();
  onDidWrite = this._writeEmitter.event;
  onDidClose = this._closeEmitter.event;

  private _proc: ChildProcess | null = null;
  private _app: string;
  private _stdoutRemainder = "";
  private _stderrRemainder = "";

  constructor(
    private readonly _command: string,
    private readonly _cwd: string,
    private readonly _onLogLine: OnLogLine,
    app?: string,
  ) {
    this._app = app ?? appFromCwd(_cwd);
  }

  open(): void {
    this._proc = spawn(this._command, {
      cwd: this._cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this._proc.stdout?.on("data", (chunk: Buffer) => {
      this._handleChunk(chunk, false);
    });

    this._proc.stderr?.on("data", (chunk: Buffer) => {
      this._handleChunk(chunk, true);
    });

    this._proc.on("error", (err) => {
      const msg = `\r\n[service-pty] Failed to start: ${err.message}\r\n`;
      this._writeEmitter.fire(msg);
    });

    this._proc.on("close", (code) => {
      const msg = `\r\n[service-pty] Process exited with code ${code ?? "unknown"}\r\n`;
      this._writeEmitter.fire(msg);
      this._closeEmitter.fire(code ?? 1);
    });
  }

  close(): void {
    if (this._proc && !this._proc.killed) {
      this._proc.kill("SIGTERM");
      setTimeout(() => {
        if (this._proc && !this._proc.killed) {
          this._proc.kill("SIGKILL");
        }
      }, 3000);
    }
  }

  private _handleChunk(chunk: Buffer, isStderr: boolean): void {
    const text = chunk.toString();
    this._writeEmitter.fire(text.replace(/\n/g, "\r\n"));

    const remainder = isStderr ? this._stderrRemainder : this._stdoutRemainder;
    const combined = remainder + text;
    const parts = combined.split("\n");
    const incomplete = combined.endsWith("\n") ? "" : (parts.pop() ?? "");

    if (isStderr) {
      this._stderrRemainder = incomplete;
    } else {
      this._stdoutRemainder = incomplete;
    }

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const parsed = parseLine(trimmed, this._app);
      if (parsed) {
        this._onLogLine(parsed);
      } else {
        this._onLogLine(rawEntry(trimmed, this._app, isStderr));
      }
    }
  }
}
