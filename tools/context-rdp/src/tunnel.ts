import net from "net";
import { GUACD_HOST, GUACD_PORT } from "./guacd.js";

/**
 * Encode a Guacamole protocol instruction.
 * Format: length.value,length.value,...;
 */
function encode(...parts: string[]): string {
  return parts.map((p) => `${p.length}.${p}`).join(",") + ";";
}

/**
 * Parse one Guacamole instruction from a buffer.
 * Returns [parsed_parts, remaining_buffer] or null if incomplete.
 */
function parseOne(buf: string): [string[], string] | null {
  const parts: string[] = [];
  let pos = 0;

  while (pos < buf.length) {
    const dotIdx = buf.indexOf(".", pos);
    if (dotIdx < 0) return null;

    const len = parseInt(buf.slice(pos, dotIdx), 10);
    if (isNaN(len)) return null;

    const valStart = dotIdx + 1;
    const valEnd = valStart + len;
    if (valEnd > buf.length) return null;

    parts.push(buf.slice(valStart, valEnd));

    const sep = buf[valEnd];
    if (sep === ";") return [parts, buf.slice(valEnd + 1)];
    if (sep === ",") {
      pos = valEnd + 1;
      continue;
    }
    return null;
  }
  return null;
}

export interface GuacTunnelOptions {
  hostname: string;
  port: number;
  username: string;
  password: string;
  domain?: string;
  width?: number;
  height?: number;
  dpi?: number;
  security?: string;
  ignoreCert?: boolean;
}

export interface GuacTunnel {
  send: (data: string) => void;
  close: () => void;
  onInstruction: (cb: (data: string) => void) => void;
  onClose: (cb: () => void) => void;
  onError: (cb: (err: Error) => void) => void;
}

/**
 * Create a tunnel to guacd for an RDP connection.
 * The tunnel speaks raw Guacamole protocol text.
 */
export function createGuacTunnel(opts: GuacTunnelOptions): Promise<GuacTunnel> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: GUACD_HOST, port: GUACD_PORT });
    let buffer = "";
    let instructionCb: ((data: string) => void) | null = null;
    let closeCb: (() => void) | null = null;
    let errorCb: ((err: Error) => void) | null = null;
    let handshakeComplete = false;

    function drain() {
      let result = parseOne(buffer);
      while (result) {
        const [parts, remaining] = result;
        buffer = remaining;

        if (!handshakeComplete) {
          handleHandshake(parts);
        } else if (instructionCb) {
          instructionCb(encode(...parts));
        }

        result = parseOne(buffer);
      }
    }

    function handleHandshake(parts: string[]) {
      const opcode = parts[0];

      if (opcode === "args") {
        // guacd sent us the arg names it expects; respond with connect + values
        const argNames = parts.slice(1);
        const argMap: Record<string, string> = {
          hostname: opts.hostname,
          port: String(opts.port),
          username: opts.username,
          password: opts.password,
          domain: opts.domain ?? "",
          width: String(opts.width ?? 1280),
          height: String(opts.height ?? 720),
          dpi: String(opts.dpi ?? 96),
          security: opts.security ?? "any",
          "ignore-cert": opts.ignoreCert !== false ? "true" : "false",
          "enable-wallpaper": "false",
          "enable-theming": "false",
          "enable-font-smoothing": "true",
          "disable-audio": "true",
          "resize-method": "display-update",
          "color-depth": "24",
        };

        const values = argNames.map((name) => argMap[name] ?? "");
        sock.write(encode("size", String(opts.width ?? 1280), String(opts.height ?? 720), "96"));
        sock.write(encode("audio"));
        sock.write(encode("video"));
        sock.write(encode("image", "image/png", "image/jpeg"));
        sock.write(encode("connect", ...values));
      } else if (opcode === "ready") {
        handshakeComplete = true;
        // Forward the ready instruction to the client
        if (instructionCb) instructionCb(encode(...parts));
        resolve(tunnel);
      } else if (opcode === "error") {
        reject(new Error(`guacd error: ${parts.slice(1).join(" ")}`));
        sock.destroy();
      }
    }

    sock.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      drain();
    });

    sock.on("error", (err) => {
      if (!handshakeComplete) {
        reject(err);
      } else if (errorCb) {
        errorCb(err);
      }
    });

    sock.on("close", () => {
      if (closeCb) closeCb();
    });

    // Start the handshake: select RDP protocol
    sock.write(encode("select", "rdp"));

    const tunnel: GuacTunnel = {
      send: (data: string) => {
        if (!sock.destroyed) sock.write(data);
      },
      close: () => {
        if (!sock.destroyed) sock.destroy();
      },
      onInstruction: (cb) => {
        instructionCb = cb;
      },
      onClose: (cb) => {
        closeCb = cb;
      },
      onError: (cb) => {
        errorCb = cb;
      },
    };
  });
}
