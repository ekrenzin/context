import path from "path";
import { allocatePort, releasePort } from "./port.js";
import { startService, stopService, checkHealth } from "./service.js";
import { registerDynamicView, unregisterDynamicView, getDynamicViews } from "./view.js";

export { allocatePort, releasePort } from "./port.js";
export { startService, stopService, checkHealth } from "./service.js";
export { registerDynamicView, unregisterDynamicView, getDynamicViews } from "./view.js";

interface ActiveService {
  pid: number;
  port: number;
  logTail: string[];
}

interface ServiceComponent {
  type: string;
  port?: number;
  entrypoint?: string;
}

interface ViewComponent {
  type: string;
  componentPath?: string;
}

const active = new Map<string, { services: ActiveService[]; viewNames: string[] }>();

export async function activateSolution(
  solutionId: string,
  solutionDir: string,
  components: unknown[],
  cmdCenterDir?: string,
): Promise<void> {
  const services: ActiveService[] = [];
  const viewNames: string[] = [];

  for (const c of components) {
    const comp = c as ServiceComponent | ViewComponent;
    if (comp.type === "service") {
      const port = allocatePort();
      const entrypoint = (comp as ServiceComponent).entrypoint ?? "server/index.ts";
      const { pid, logTail, process: proc } = startService(
        solutionDir, port, entrypoint, undefined, cmdCenterDir,
      );
      services.push({ pid, port, logTail });

      // Wait briefly then check if process is still alive
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            process.kill(pid, 0);
            resolve();
          } catch {
            reject(new Error(
              `Service crashed on startup:\n${logTail.join("\n")}`,
            ));
          }
        }, 1500);
        proc.on("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(
            `Service exited with code ${code}:\n${logTail.join("\n")}`,
          ));
        });
      });
    }
    if (comp.type === "view") {
      const componentPath = (comp as ViewComponent).componentPath ?? "view";
      const name = `${solutionId}:${componentPath}`;
      const routePath = `/solutions/${solutionId}/${componentPath}`;
      const label = path.basename(componentPath);
      registerDynamicView(name, routePath, label);
      viewNames.push(name);
    }
  }

  active.set(solutionId, { services, viewNames });
}

export async function deactivateSolution(solutionId: string): Promise<void> {
  const entry = active.get(solutionId);
  if (!entry) return;

  for (const { pid, port } of entry.services) {
    await stopService(pid);
    releasePort(port);
  }
  for (const name of entry.viewNames) {
    unregisterDynamicView(name);
  }
  active.delete(solutionId);
}

export function getHealth(solutionId: string): { running: boolean; logTail: string[] } {
  const entry = active.get(solutionId);
  if (!entry || entry.services.length === 0) {
    return { running: false, logTail: [] };
  }
  const logTail = entry.services.flatMap((s) => s.logTail);
  const running = entry.services.some((s) => {
    try {
      process.kill(s.pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  return { running, logTail };
}

/** Returns the first active service port for a solution, or undefined if not running. */
export function getServicePort(solutionId: string): number | undefined {
  const entry = active.get(solutionId);
  if (!entry || entry.services.length === 0) return undefined;
  return entry.services[0].port;
}

export async function shutdownAll(): Promise<void> {
  const ids = Array.from(active.keys());
  for (const id of ids) {
    await deactivateSolution(id);
  }
}
