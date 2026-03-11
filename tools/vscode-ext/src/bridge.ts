import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { readCredentials, topicFor, statusTopic } from "ctx-mqtt";
import { dispatchBridgeCommand } from "./bridgeDispatch";
import { BridgeTasks } from "./bridgeTasks";
import type { MqttEventStore } from "./mqttEvents";
import type { WSMessage } from "./bridgeTypes";

const CREDS_DIR = path.join(os.homedir(), ".ctx", "mqtt");
const CREDS_FILENAME = "credentials.json";
const WILDCARD = topicFor("#");
const CMD = topicFor("vscode/cmd");
const STATUS = topicFor("vscode/status");

export class DashboardBridge {
  private _client: MqttClient | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _credsWatcher: fs.FSWatcher | null = null;
  private _disposables: vscode.Disposable[] = [];
  private _statusInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _eventStore: MqttEventStore | null = null;
  private readonly _tasks: BridgeTasks;

  constructor(
    private readonly _root: string,
    private readonly _port: number,
  ) {
    this._tasks = new BridgeTasks(this._root, (topic, payload) => {
      if (this._client && this._connected) {
        this._client.publish(topic, payload);
      }
    });
  }

  setEventStore(store: MqttEventStore): void {
    this._eventStore = store;
  }

  connect(): void {
    this._connectWithCreds();
    this._watchCredentials();
  }

  private _watchCredentials(): void {
    if (this._credsWatcher) return;
    try {
      this._credsWatcher = fs.watch(CREDS_DIR, (_event, filename) => {
        if (filename !== CREDS_FILENAME) return;
        console.log("[ctx-ext] Credentials changed -- reconnecting");
        this._disconnectClient();
        setTimeout(() => this._connectWithCreds(), 500);
      });
    } catch { /* dir may not exist yet */ }
  }

  private _connectWithCreds(): void {
    if (this._client) return;

    const creds = readCredentials();
    if (!creds) {
      console.warn("[ctx-ext] No MQTT credentials -- waiting for file change");
      return;
    }

    const opts: mqtt.IClientOptions = {
      clientId: `cc-extension-${process.pid}-${Date.now().toString(36)}`,
      username: creds.username,
      password: creds.password,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
      clean: true,
      will: {
        topic: STATUS,
        payload: Buffer.from(JSON.stringify({ status: "offline" })),
        qos: 1,
        retain: true,
      },
    };

    let url: string;
    if (creds.brokerCertPath) {
      try {
        opts.ca = [fs.readFileSync(creds.brokerCertPath)];
        opts.rejectUnauthorized = true;
        url = `mqtts://127.0.0.1:${creds.tcpPort}`;
      } catch {
        url = `mqtt://127.0.0.1:${creds.tcpPort}`;
      }
    } else {
      url = `mqtt://127.0.0.1:${creds.tcpPort}`;
    }

    this._eventStore?.setConnection("connecting", url);
    this._client = mqtt.connect(url, opts);

    this._client.on("connect", () => {
      this._connected = true;
      this._eventStore?.setConnection("connected", url);
      this._client!.subscribe(WILDCARD, { qos: 1 });
      this._client!.publish(STATUS, JSON.stringify({ status: "online" }), { qos: 1, retain: true });
      this._setupTaskListeners();
      this._sendServiceStatus();
      this._statusInterval = setInterval(() => this._sendServiceStatus(), 5000);
    });

    this._client.on("message", (topic, payload) => {
      const raw = payload.toString();
      this._eventStore?.push(topic, raw);

      if (topic === CMD) {
        try {
          const msg = JSON.parse(raw) as WSMessage;
          void dispatchBridgeCommand(msg, {
            root: this._root,
            tasks: this._tasks,
          });
        } catch { /* ignore malformed */ }
      }
    });

    this._client.on("offline", () => {
      this._connected = false;
      this._eventStore?.setConnection("disconnected");
      this._cleanup();
    });

    this._client.on("error", () => {});
  }

  private _disconnectClient(): void {
    this._cleanup();
    if (this._client) {
      if (this._connected) {
        this._client.publish(STATUS, JSON.stringify({ status: "offline" }), { qos: 1, retain: true });
      }
      this._client.end(true);
      this._client = null;
    }
    this._connected = false;
    this._eventStore?.setConnection("disconnected");
  }

  dispose(): void {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._credsWatcher?.close();
    this._credsWatcher = null;
    this._disconnectClient();
  }

  private _cleanup(): void {
    if (this._statusInterval) {
      clearInterval(this._statusInterval);
      this._statusInterval = null;
    }
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }

  private _publish(topic: string, msg: WSMessage): void {
    if (this._client && this._connected) {
      this._client.publish(topic, JSON.stringify(msg));
    }
  }

  private _setupTaskListeners(): void {
    this._disposables.push(
      vscode.tasks.onDidStartTask(() => this._sendServiceStatus()),
      vscode.tasks.onDidEndTask(() => this._sendServiceStatus()),
    );
  }

  private _sendServiceStatus(): void {
    this._tasks.sendServiceStatus((topic, message) => {
      this._publish(topic, message);
    });
  }
}
