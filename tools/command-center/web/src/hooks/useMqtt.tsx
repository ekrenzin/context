import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { topicFor } from "ctx-mqtt/topics";

const BROKER_WS_URL = "ws://127.0.0.1:9001";
const RECONNECT_MS = 3_000;

interface MqttContextValue {
  connected: boolean;
  publish: (topic: string, payload: unknown) => void;
  subscribe: (topic: string, handler: (payload: unknown, topic: string) => void) => () => void;
}

const MqttContext = createContext<MqttContextValue>({
  connected: false,
  publish: () => {},
  subscribe: () => () => {},
});

export function MqttProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<MqttClient | null>(null);
  const handlersRef = useRef(new Map<string, Set<(payload: unknown, topic: string) => void>>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let activeClient: MqttClient | null = null;

    async function connect() {
      const opts: Parameters<typeof mqtt.connect>[1] = {
        clientId: `cc-browser-${Date.now().toString(36)}`,
        reconnectPeriod: RECONNECT_MS,
        connectTimeout: 10_000,
        clean: true,
      };

      try {
        const res = await fetch("/api/mqtt-credentials");
        if (res.ok) {
          const { username, password } = await res.json();
          if (username) {
            opts.username = username;
            opts.password = password;
          }
        }
      } catch {
        // CC server unavailable -- attempt anonymous
      }

      if (cancelled) return;

      const client = mqtt.connect(BROKER_WS_URL, opts);
      activeClient = client;
      clientRef.current = client;

      client.on("connect", () => setConnected(true));
      client.on("offline", () => setConnected(false));
      client.on("error", () => {});

      client.on("message", (topic, payload) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload.toString());
        } catch {
          parsed = payload.toString();
        }

        for (const [pattern, handlers] of handlersRef.current) {
          if (topicMatches(topic, pattern)) {
            for (const handler of handlers) {
              handler(parsed, topic);
            }
          }
        }
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (activeClient) activeClient.end(true);
      clientRef.current = null;
    };
  }, []);

  const publish = useCallback((topic: string, payload: unknown) => {
    const client = clientRef.current;
    if (client?.connected) {
      client.publish(topic, JSON.stringify(payload));
    }
  }, []);

  const subscribe = useCallback(
    (topic: string, handler: (payload: unknown, topic: string) => void) => {
      if (!handlersRef.current.has(topic)) {
        handlersRef.current.set(topic, new Set());
        clientRef.current?.subscribe(topic, { qos: 1 });
      }
      handlersRef.current.get(topic)!.add(handler);

      return () => {
        const handlers = handlersRef.current.get(topic);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            handlersRef.current.delete(topic);
            clientRef.current?.unsubscribe(topic);
          }
        }
      };
    },
    [],
  );

  return (
    <MqttContext.Provider value={{ connected, publish, subscribe }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqttConnected(): boolean {
  return useContext(MqttContext).connected;
}

export function useMqttPublish(): (topic: string, payload: unknown) => void {
  return useContext(MqttContext).publish;
}

/**
 * Subscribe to an MQTT topic and get the latest parsed payload.
 * Retained messages are delivered immediately on subscribe.
 */
export function useMqttTopic<T = unknown>(topic: string): T | null {
  const { subscribe } = useContext(MqttContext);
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    return subscribe(topic, (payload) => {
      setValue(payload as T);
    });
  }, [topic, subscribe]);

  return value;
}

/**
 * Subscribe to an MQTT topic and buffer incoming messages into an array.
 * Useful for log streams or event feeds.
 */
export function useMqttBuffer<T = unknown>(
  topic: string,
  maxSize = 500,
): T[] {
  const { subscribe } = useContext(MqttContext);
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    return subscribe(topic, (payload) => {
      setItems((prev) => {
        const next = [...prev, payload as T];
        return next.length > maxSize ? next.slice(-maxSize) : next;
      });
    });
  }, [topic, maxSize, subscribe]);

  return items;
}


function topicMatches(topic: string, pattern: string): boolean {
  if (pattern === "#" || pattern === topic) return true;
  const topicParts = topic.split("/");
  const patternParts = pattern.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "#") return true;
    if (patternParts[i] === "+") continue;
    if (patternParts[i] !== topicParts[i]) return false;
  }
  return topicParts.length === patternParts.length;
}
