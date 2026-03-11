import * as path from "path";
import * as vscode from "vscode";
import { DashboardBridge } from "./bridge";
import { spawnManagedProcess, waitForHttp, type ManagedProcess } from "./dashboardRuntime";
import type { MqttEventStore } from "./mqttEvents";

export type ServerStatus = "stopped" | "starting" | "running" | "error";

export interface ServerSnapshot {
  status: ServerStatus;
  port: number;
  webPort: number;
  liveReload: boolean;
  pid?: number;
  webPid?: number;
  lastError?: string;
  recentLogs: string[];
}

interface ManagerConfig {
  getRoot: () => string;
  getPort: () => number;
  getWebPort: () => number;
  getLiveReload: () => boolean;
}

export class DashboardServerManager implements vscode.Disposable {
  private apiProcess: ManagedProcess | null = null;
  private webProcess: ManagedProcess | null = null;
  private bridge: DashboardBridge | null = null;
  private logs: string[] = [];
  private status: ServerStatus = "stopped";
  private lastError: string | undefined;
  private expectedStop = false;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  private _mqttStore: MqttEventStore | null = null;

  public readonly onDidChange = this.onDidChangeEmitter.event;

  public constructor(private readonly config: ManagerConfig) {}

  public setMqttStore(store: MqttEventStore): void {
    this._mqttStore = store;
  }

  public getSnapshot(): ServerSnapshot {
    return {
      status: this.status,
      port: this.config.getPort(),
      webPort: this.config.getWebPort(),
      liveReload: this.config.getLiveReload(),
      pid: this.apiProcess?.process.pid,
      webPid: this.webProcess?.process.pid,
      lastError: this.lastError,
      recentLogs: [...this.logs],
    };
  }

  public async start(): Promise<void> {
    if (this.status === "running" || this.status === "starting") return;

    const root = this.config.getRoot();
    if (!root) {
      throw new Error("No workspace folder found.");
    }

    const port = this.config.getPort();
    const webPort = this.config.getWebPort();
    const liveReload = this.config.getLiveReload();
    this.markStarting();
    this.startApiProcess(root, port);

    try {
      await waitForHttp(port, "/api/config");
      if (liveReload) {
        this.startWebProcess(root, webPort);
        await waitForHttp(webPort, "/");
      }
    } catch (err) {
      this.stopProcesses();
      this.handleStartFailure(err);
    }

    if (!this.apiProcess) {
      throw new Error("Dashboard server exited before becoming ready.");
    }

    this.markRunning(root, port);
  }

  public async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  public stop(): void {
    this.expectedStop = true;
    this.disposeBridge();
    this.stopProcesses();
    this.status = "stopped";
    this.emitChange();
  }

  public async openDashboard(theme: "light" | "dark"): Promise<void> {
    await this.start();
    const basePort = this.config.getLiveReload() ? this.config.getWebPort() : this.config.getPort();
    const uri = vscode.Uri.parse(`http://127.0.0.1:${basePort}?theme=${theme}`);
    const opened = await vscode.env.openExternal(uri);
    if (!opened) {
      await vscode.commands.executeCommand("simpleBrowser.show", uri);
    }
  }

  public dispose(): void {
    this.stop();
    this.onDidChangeEmitter.dispose();
  }

  private captureLog(line: string): void {
    this.logs.push(line);
    if (this.logs.length > 120) {
      this.logs.splice(0, this.logs.length - 120);
    }
    this.emitChange();
  }

  private markStarting(): void {
    this.expectedStop = false;
    this.status = "starting";
    this.lastError = undefined;
    this.emitChange();
  }

  private startApiProcess(root: string, port: number): void {
    const dashboardDir = path.join(root, "tools", "command-center");
    const serverEntry = path.join(dashboardDir, "server", "index.ts");
    this.apiProcess = spawnManagedProcess(
      "npx",
      ["tsx", "watch", serverEntry],
      dashboardDir,
      { ...process.env, CTX_ROOT: root, CTX_DASHBOARD_PORT: String(port) },
      (line) => this.captureLog(`[API] ${line}`),
      (message) => this.handleProcessError("API", message),
    );
    this.apiProcess.process.on("exit", (code) => this.handleProcessExit("API", code));
  }

  private startWebProcess(root: string, webPort: number): void {
    if (this.webProcess) return;
    const dashboardDir = path.join(root, "tools", "command-center");
    this.webProcess = spawnManagedProcess(
      "npx",
      ["vite", "--config", "web/vite.config.ts", "--host", "127.0.0.1", "--port", String(webPort)],
      dashboardDir,
      { ...process.env },
      (line) => this.captureLog(`[WEB] ${line}`),
      (message) => this.handleProcessError("WEB", message),
    );
    this.webProcess.process.on("exit", (code) => this.handleProcessExit("WEB", code));
  }

  private stopProcesses(): void {
    this.apiProcess?.stop();
    this.webProcess?.stop();
    this.apiProcess = null;
    this.webProcess = null;
  }

  private handleProcessError(kind: "API" | "WEB", message: string): void {
    this.lastError = `${kind}: ${message}`;
    this.status = "error";
    this.stopProcesses();
    this.emitChange();
  }

  private handleProcessExit(kind: "API" | "WEB", code: number | null): void {
    if (kind === "API") this.apiProcess = null;
    if (kind === "WEB") this.webProcess = null;
    const message = code && code !== 0 ? `${kind} exited with code ${code}` : undefined;
    if (!this.expectedStop && message) {
      this.lastError = message;
      this.status = "error";
    } else {
      this.status = "stopped";
    }
    this.emitChange();
  }

  private handleStartFailure(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    this.lastError = message;
    this.status = "error";
    this.emitChange();
    throw new Error(`Failed to start Command Center server: ${message}`);
  }

  private markRunning(root: string, port: number): void {
    this.status = "running";
    this.lastError = undefined;
    this.ensureBridgeConnected(root, port);
    this.emitChange();
  }

  private ensureBridgeConnected(root: string, port: number): void {
    if (this.bridge) return;
    this.bridge = new DashboardBridge(root, port);
    if (this._mqttStore) this.bridge.setEventStore(this._mqttStore);
    this.bridge.connect();
  }

  private disposeBridge(): void {
    if (!this.bridge) return;
    this.bridge.dispose();
    this.bridge = null;
  }

  private emitChange(): void {
    this.onDidChangeEmitter.fire();
  }
}
