import { EventEmitter } from "events";

export type ConnectionState = "connected" | "disconnected" | "connecting";

export interface MqttEvent {
  topic: string;
  payload: string;
  timestamp: number;
}

export interface ServiceStatus {
  topic: string;
  label: string;
  online: boolean;
  raw: string;
}

const MAX_EVENTS = 200;
const STATUS_SUFFIX = "/status";

function labelFromStatusTopic(topic: string): string {
  const parts = topic.split("/");
  const service = parts[parts.length - 2] ?? "unknown";
  const labels: Record<string, string> = {
    cc: "Server",
    vscode: "Extension",
    teams: "Teams Bot",
  };
  return labels[service] ?? service;
}

export class MqttEventStore extends EventEmitter {
  private _events: MqttEvent[] = [];
  private _statuses = new Map<string, ServiceStatus>();
  private _connection: ConnectionState = "disconnected";
  private _brokerUrl = "";

  get events(): readonly MqttEvent[] {
    return this._events;
  }

  get statuses(): ReadonlyMap<string, ServiceStatus> {
    return this._statuses;
  }

  get connection(): ConnectionState {
    return this._connection;
  }

  get brokerUrl(): string {
    return this._brokerUrl;
  }

  get eventCount(): number {
    return this._events.length;
  }

  setConnection(state: ConnectionState, url?: string): void {
    this._connection = state;
    if (url) this._brokerUrl = url;
    this.emit("change");
  }

  push(topic: string, payload: string): void {
    const event: MqttEvent = { topic, payload, timestamp: Date.now() };
    this._events.push(event);
    if (this._events.length > MAX_EVENTS) {
      this._events.splice(0, this._events.length - MAX_EVENTS);
    }

    if (topic.endsWith(STATUS_SUFFIX)) {
      this._updateServiceStatus(topic, payload);
    }

    this.emit("change");
  }

  clear(): void {
    this._events = [];
    this.emit("change");
  }

  private _updateServiceStatus(topic: string, raw: string): void {
    let online = false;
    try {
      const parsed = JSON.parse(raw);
      online = parsed.status === "online";
    } catch { /* treat malformed as offline */ }

    this._statuses.set(topic, {
      topic,
      label: labelFromStatusTopic(topic),
      online,
      raw,
    });
  }
}
