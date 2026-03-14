export interface RdpConfig {
  hostname: string;
  port: number;
  username: string;
  domain: string;
  width: number;
  height: number;
  raw: Record<string, string>;
}

/**
 * Parse an AWS-style .rdp config file.
 * Format: `key:type:value` per line (type is s=string, i=integer, b=binary).
 */
export function parseRdpConfig(text: string): RdpConfig {
  const raw: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Format: key:type:value  (e.g., "full address:s:10.0.0.1:3389")
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1);
    // Skip the type marker (s:, i:, b:)
    const typeIdx = rest.indexOf(":");
    const value = typeIdx >= 0 ? rest.slice(typeIdx + 1).trim() : rest.trim();
    raw[key] = value;
  }

  const fullAddress = raw["full address"] ?? "";
  let hostname = fullAddress;
  let port = 3389;

  // Handle "host:port" format
  const lastColon = fullAddress.lastIndexOf(":");
  if (lastColon > 0) {
    const maybePart = fullAddress.slice(lastColon + 1);
    const maybePort = parseInt(maybePart, 10);
    if (!isNaN(maybePort) && maybePort > 0 && maybePort < 65536) {
      hostname = fullAddress.slice(0, lastColon);
      port = maybePort;
    }
  }

  if (raw["server port"]) {
    const parsed = parseInt(raw["server port"], 10);
    if (!isNaN(parsed)) port = parsed;
  }

  return {
    hostname,
    port,
    username: raw["username"] ?? "",
    domain: raw["domain"] ?? "",
    width: parseInt(raw["desktopwidth"] ?? "1280", 10),
    height: parseInt(raw["desktopheight"] ?? "720", 10),
    raw,
  };
}
