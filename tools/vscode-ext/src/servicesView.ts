import * as vscode from "vscode";
import { DashboardServerManager, type ServerStatus } from "./dashboardServer";
import type { MqttEventStore, MqttEvent } from "./mqttEvents";

type NodeType =
  | "status"
  | "action"
  | "logs"
  | "logLine"
  | "mqttHeader"
  | "mqttService"
  | "mqttFeedHeader"
  | "mqttEvent"
  | "mqttPayload";

interface NodeItem {
  type: NodeType;
  id: string;
  label: string;
  description?: string;
  command?: string;
  event?: MqttEvent;
  online?: boolean;
}

const REFRESH_DEBOUNCE_MS = 250;

function serverIcon(status: ServerStatus): vscode.ThemeIcon {
  if (status === "running") return new vscode.ThemeIcon("pass-filled");
  if (status === "starting") return new vscode.ThemeIcon("loading~spin");
  if (status === "error") return new vscode.ThemeIcon("warning");
  return new vscode.ThemeIcon("circle-outline");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function shortTopic(topic: string): string {
  return topic.startsWith("ctx/") ? topic.slice(4) : topic;
}

function previewPayload(raw: string, maxLen = 60): string {
  const line = raw.replace(/\s+/g, " ").trim();
  return line.length <= maxLen ? line : line.slice(0, maxLen) + "...";
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export class ServicesTreeProvider implements vscode.TreeDataProvider<NodeItem> {
  private readonly _emitter = new vscode.EventEmitter<NodeItem | undefined>();
  public readonly onDidChangeTreeData = this._emitter.event;
  private _mqttStore: MqttEventStore | null = null;
  private _mqttTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly manager: DashboardServerManager) {
    this.manager.onDidChange(() => this._emitter.fire(undefined));
  }

  setMqttStore(store: MqttEventStore): void {
    this._mqttStore = store;
    store.on("change", () => this._scheduleMqttRefresh());
  }

  public getTreeItem(node: NodeItem): vscode.TreeItem {
    switch (node.type) {
      case "logs":
      case "mqttHeader":
      case "mqttFeedHeader":
        return this._collapsibleItem(node);
      case "logLine":
        return this._logLineItem(node);
      case "mqttService":
        return this._mqttServiceItem(node);
      case "mqttEvent":
        return this._mqttEventItem(node);
      case "mqttPayload":
        return this._mqttPayloadItem(node);
      default:
        return this._flatItem(node);
    }
  }

  public getChildren(node?: NodeItem): NodeItem[] {
    if (!node) return this._rootChildren();
    switch (node.type) {
      case "logs": return this._logChildren();
      case "mqttHeader": return this._mqttStatusChildren();
      case "mqttFeedHeader": return this._mqttFeedChildren();
      case "mqttEvent": return node.event ? this._mqttPayloadChildren(node.event) : [];
      default: return [];
    }
  }

  private _rootChildren(): NodeItem[] {
    const snap = this.manager.getSnapshot();
    const children: NodeItem[] = [
      { type: "status", id: "status", label: "Web Server", description: this._describeStatus(snap) },
      {
        type: "status", id: "ports", label: "Ports",
        description: snap.liveReload ? `API ${snap.port} | Web ${snap.webPort}` : `API ${snap.port}`,
      },
      { type: "action", id: "action-open", label: "Open Dashboard", command: "ctx.openDashboard" },
    ];

    if (snap.status === "running" || snap.status === "starting") {
      children.push({ type: "action", id: "action-stop", label: "Stop Server", command: "ctx.stopDashboardServer" });
      children.push({ type: "action", id: "action-restart", label: "Restart Server", command: "ctx.restartDashboardServer" });
    } else {
      children.push({ type: "action", id: "action-start", label: "Start Server", command: "ctx.startDashboardServer" });
    }

    if (snap.lastError) {
      children.push({ type: "status", id: "last-error", label: "Last Error", description: snap.lastError });
    }

    children.push({ type: "logs", id: "logs", label: "Recent Logs" });

    if (this._mqttStore) {
      const conn = this._mqttStore.connection;
      const desc = conn === "connected"
        ? `Connected (${this._mqttStore.brokerUrl})`
        : conn === "connecting" ? "Connecting..." : "Disconnected";
      children.push({ type: "mqttHeader", id: "mqtt", label: "MQTT Broker", description: desc });
      children.push({
        type: "mqttFeedHeader", id: "mqtt-feed", label: "MQTT Events",
        description: `(${this._mqttStore.eventCount})`,
      });
    }

    return children;
  }

  private _logChildren(): NodeItem[] {
    const logs = this.manager.getSnapshot().recentLogs.slice(-20).reverse();
    if (logs.length === 0) return [{ type: "logLine", id: "log-empty", label: "No logs yet." }];
    return logs.map((line, i) => ({ type: "logLine" as const, id: `log-${i}`, label: line }));
  }

  private _mqttStatusChildren(): NodeItem[] {
    if (!this._mqttStore) return [];
    const statuses = [...this._mqttStore.statuses.values()];
    if (statuses.length === 0) {
      return [{ type: "mqttService", id: "no-svc", label: "No services reported yet" }];
    }
    return statuses.map((s) => ({
      type: "mqttService" as const,
      id: `svc-${s.topic}`,
      label: s.label,
      description: s.online ? "online" : "offline",
      online: s.online,
    }));
  }

  private _mqttFeedChildren(): NodeItem[] {
    if (!this._mqttStore) return [];
    const events = this._mqttStore.events;
    if (events.length === 0) return [{ type: "mqttEvent", id: "no-ev", label: "No events yet" }];
    return events.slice().reverse().slice(0, 50).map((ev, i) => ({
      type: "mqttEvent" as const,
      id: `ev-${events.length - i}`,
      label: `${formatTime(ev.timestamp)} ${shortTopic(ev.topic)}`,
      description: previewPayload(ev.payload),
      event: ev,
    }));
  }

  private _mqttPayloadChildren(ev: MqttEvent): NodeItem[] {
    return [{ type: "mqttPayload", id: `pay-${ev.timestamp}`, label: prettyJson(ev.payload) }];
  }

  private _collapsibleItem(node: NodeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
    item.id = node.id;
    item.description = node.description;
    const icons: Record<string, string> = {
      logs: "output",
      mqttHeader: this._mqttStore?.connection === "connected" ? "pass-filled" : "circle-outline",
      mqttFeedHeader: "list-flat",
    };
    item.iconPath = new vscode.ThemeIcon(icons[node.type] ?? "symbol-folder");
    return item;
  }

  private _flatItem(node: NodeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.description = node.description;
    if (node.type === "status") item.iconPath = serverIcon(this.manager.getSnapshot().status);
    if (node.type === "action") item.iconPath = this._actionIcon(node.command);
    if (node.command) item.command = { command: node.command, title: node.label };
    return item;
  }

  private _logLineItem(node: NodeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.iconPath = new vscode.ThemeIcon("chevron-right");
    item.tooltip = node.label;
    return item;
  }

  private _mqttServiceItem(node: NodeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.description = node.description;
    item.iconPath = node.online
      ? new vscode.ThemeIcon("pass-filled")
      : new vscode.ThemeIcon("warning");
    return item;
  }

  private _mqttEventItem(node: NodeItem): vscode.TreeItem {
    const hasPayload = !!node.event;
    const state = hasPayload ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.label, state);
    item.id = node.id;
    item.description = node.description;
    item.iconPath = new vscode.ThemeIcon("chevron-right");
    if (node.event) item.tooltip = `${node.event.topic}\n${prettyJson(node.event.payload)}`;
    return item;
  }

  private _mqttPayloadItem(node: NodeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.iconPath = new vscode.ThemeIcon("json");
    return item;
  }

  private _actionIcon(cmd?: string): vscode.ThemeIcon {
    const map: Record<string, string> = {
      "ctx.startDashboardServer": "play",
      "ctx.stopDashboardServer": "stop",
      "ctx.restartDashboardServer": "debug-restart",
      "ctx.openDashboard": "globe",
    };
    return new vscode.ThemeIcon(cmd && map[cmd] ? map[cmd] : "run");
  }

  private _describeStatus(snap: { status: ServerStatus; pid?: number; liveReload: boolean }): string {
    const mode = snap.liveReload ? "Live" : "Built";
    if (snap.status === "running") return `${mode} running${snap.pid ? ` (pid ${snap.pid})` : ""}`;
    if (snap.status === "starting") return "Starting";
    if (snap.status === "error") return "Error";
    return "Stopped";
  }

  private _scheduleMqttRefresh(): void {
    if (this._mqttTimer) return;
    this._mqttTimer = setTimeout(() => {
      this._mqttTimer = null;
      this._emitter.fire(undefined);
    }, REFRESH_DEBOUNCE_MS);
  }
}
