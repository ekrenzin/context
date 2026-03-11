import { Aedes, type Client } from "aedes";
import { createServer as createHttpServer, type Server as HttpServer } from "http";
import { createServer as createNetServer, type Server as NetServer } from "net";
import { WebSocketServer, createWebSocketStream } from "ws";

export interface EmbeddedBrokerConfig {
  tcpPort: number;
  wsPort: number;
  username: string;
  password: string;
}

export interface EmbeddedBroker {
  stop(): Promise<void>;
}

function listenAsync(
  server: NetServer | HttpServer,
  port: number,
  host: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

function closeServerAsync(server: NetServer | HttpServer): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

export async function startEmbeddedBroker(
  config: EmbeddedBrokerConfig,
): Promise<EmbeddedBroker> {
  const { tcpPort, wsPort, username, password } = config;

  const aedes = await Aedes.createBroker({
    authenticate(
      _client: Client,
      user: Readonly<string | undefined>,
      pass: Readonly<Buffer | undefined>,
      done,
    ) {
      if (!user || !pass) {
        done(null, false);
        return;
      }

      done(null, user === username && pass.toString() === password);
    },
  });

  const tcpServer = createNetServer(aedes.handle);
  await listenAsync(tcpServer, tcpPort, "127.0.0.1");

  const httpServer = createHttpServer();
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    const stream = createWebSocketStream(ws);
    aedes.handle(stream as never);
  });

  await listenAsync(httpServer, wsPort, "127.0.0.1");
  console.log(`[broker] Aedes ready -- TCP ${tcpPort}, WebSocket ${wsPort}`);

  return {
    async stop() {
      wss.close();
      await Promise.all([
        closeServerAsync(httpServer),
        closeServerAsync(tcpServer),
      ]);
      await new Promise<void>((resolve) => {
        aedes.close(() => resolve());
      });
    },
  };
}
