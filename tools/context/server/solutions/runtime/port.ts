import { getDb } from "../../db/index.js";

const PORT_MIN = 19480;
const PORT_MAX = 19599;

interface ServiceComponent {
  type: string;
  port?: number;
}

function isServiceComponent(c: unknown): c is ServiceComponent {
  return c !== null && typeof c === "object" && "type" in c && (c as ServiceComponent).type === "service";
}

function parseComponents(json: string): ServiceComponent[] {
  try {
    const arr = JSON.parse(json) as unknown[];
    return Array.isArray(arr) ? arr.filter(isServiceComponent) : [];
  } catch {
    return [];
  }
}

export function allocatePort(): number {
  const db = getDb();
  const rows = db.prepare("SELECT components FROM solutions WHERE status = 'active'").all() as { components: string }[];
  const used = new Set<number>();
  for (const row of rows) {
    const services = parseComponents(row.components);
    for (const s of services) {
      if (typeof s.port === "number" && s.port >= PORT_MIN && s.port <= PORT_MAX) {
        used.add(s.port);
      }
    }
  }
  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    if (!used.has(p)) return p;
  }
  throw new Error(`No free port in range ${PORT_MIN}-${PORT_MAX}`);
}

export function releasePort(_port: number): void {
  // Port is freed when solution status changes; no-op for now
}
