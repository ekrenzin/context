import fs from "fs";
import mqtt from "mqtt";
import type { IClientOptions, MqttClient } from "mqtt";
import { readCredentials } from "./security";
import { statusTopic } from "./topics";

const FALLBACK_URL = "ws://127.0.0.1:9001";
const RECONNECT_MS = 5_000;

export interface MqttConfig {
  url: string;
  clientId: string;
}

export interface CtxMqttClient {
  publish(topic: string, payload: unknown, retain?: boolean): void;
  subscribe(topic: string, handler: (topic: string, payload: Buffer) => void): void;
  readRetained(topic: string, timeoutMs?: number): Promise<unknown | null>;
  connected(): boolean;
  close(): Promise<void>;
  raw(): MqttClient | null;
}

function buildClientId(): string {
  return `ctx-server-${process.pid}-${Date.now().toString(36)}`;
}

function resolveUrl(config?: Partial<MqttConfig>): string {
  if (config?.url ?? process.env.CTX_MQTT_URL) {
    return (config?.url ?? process.env.CTX_MQTT_URL)!;
  }

  const creds = readCredentials();
  if (creds?.brokerCertPath) return `mqtts://127.0.0.1:${creds.tcpPort}`;
  if (creds) return `mqtt://127.0.0.1:${creds.tcpPort}`;
  return FALLBACK_URL;
}

function matchesMqttWildcard(topic: string, pattern: string): boolean {
  if (pattern === "#") return true;
  const topicParts = topic.split("/");
  const patternParts = pattern.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "#") return true;
    if (patternParts[i] === "+") continue;
    if (patternParts[i] !== topicParts[i]) return false;
  }

  return topicParts.length === patternParts.length;
}

export function createMqttClient(
  config?: Partial<MqttConfig>,
): CtxMqttClient {
  const creds = readCredentials();
  const clientId = config?.clientId ?? buildClientId();
  const url = resolveUrl(config);

  const opts: IClientOptions = {
    clientId,
    clean: true,
    reconnectPeriod: RECONNECT_MS,
    connectTimeout: 10_000,
    will: {
      topic: statusTopic(),
      payload: Buffer.from(JSON.stringify({ status: "offline", pid: process.pid })),
      qos: 1,
      retain: true,
    },
  };

  if (creds) {
    opts.username = creds.username;
    opts.password = creds.password;
    if (creds.brokerCertPath) {
      try {
        opts.ca = [fs.readFileSync(creds.brokerCertPath)];
        opts.rejectUnauthorized = true;
      } catch {
        console.warn("[mqtt] could not read broker cert -- connecting without TLS");
      }
    }
  }

  const client = mqtt.connect(url, opts);
  let isConnected = false;

  client.on("connect", () => {
    isConnected = true;
    console.log(`[mqtt] connected to broker at ${url}`);
    client.publish(
      statusTopic(),
      JSON.stringify({ status: "online", pid: process.pid }),
      { qos: 1, retain: true },
    );
  });

  client.on("offline", () => {
    isConnected = false;
  });

  client.on("error", (err) => {
    console.warn(`[mqtt] ${err.message}`);
  });

  return {
    publish(topic, payload, retain = false) {
      if (!isConnected) return;
      const data =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      client.publish(topic, data, { qos: retain ? 1 : 0, retain });
    },

    subscribe(topic, handler) {
      client.subscribe(topic, { qos: 1 });
      client.on("message", (t, p) => {
        if (t === topic || matchesMqttWildcard(t, topic)) {
          handler(t, p);
        }
      });
    },

    readRetained(topic, timeoutMs = 3000) {
      return new Promise((resolve) => {
        if (!isConnected) {
          resolve(null);
          return;
        }
        const timer = setTimeout(() => {
          client.unsubscribe(topic);
          resolve(null);
        }, timeoutMs);

        const onMessage = (t: string, p: Buffer) => {
          if (t !== topic) return;
          clearTimeout(timer);
          client.removeListener("message", onMessage);
          client.unsubscribe(topic);
          try {
            resolve(JSON.parse(p.toString()));
          } catch {
            resolve(p.toString());
          }
        };

        client.on("message", onMessage);
        client.subscribe(topic, { qos: 1 });
      });
    },

    connected() {
      return isConnected;
    },

    async close() {
      if (isConnected) {
        client.publish(
          statusTopic(),
          JSON.stringify({ status: "offline", pid: process.pid }),
          { qos: 1, retain: true },
        );
      }
      await client.endAsync();
    },

    raw() {
      return client;
    },
  };
}
