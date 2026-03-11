import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { DashboardConfig, TestConfig, QuickAction, LogPrefix } from "../types.js";

type Entry = Record<string, string>;

interface ManifestData {
  tools: Entry[];
  actions: Entry[];
  tests: Entry[];
  logPrefixes: Entry[];
  logWindows: string[];
}

function parseManifest(raw: string): ManifestData {
  const sections: Record<string, Entry[] | string[]> = {};
  let section = "";
  let current: Entry | null = null;

  function flush(): void {
    if (current && section && sections[section]) {
      (sections[section] as Entry[]).push(current);
    }
    current = null;
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = line.match(/^(\w[\w_]*):\s*$/);
    if (sectionMatch) {
      flush();
      section = sectionMatch[1];
      sections[section] = [];
      continue;
    }
    if (!section) continue;

    const dashMatch = line.match(/^\s+-\s+(.*)/);
    if (dashMatch) {
      const content = dashMatch[1].trim();
      const kv = content.match(/^(\w[\w_]*):\s*(.+)/);
      if (kv) {
        flush();
        current = { [kv[1]]: kv[2].trim() };
      } else {
        flush();
        (sections[section] as string[]).push(content);
      }
      continue;
    }

    const contMatch = line.match(/^\s+(\w[\w_]*):\s*(.+)/);
    if (contMatch && current) {
      current[contMatch[1]] = contMatch[2].trim();
    }
  }
  flush();

  return {
    tools: (sections.tools ?? []) as Entry[],
    actions: (sections.actions ?? []) as Entry[],
    tests: (sections.tests ?? []) as Entry[],
    logPrefixes: (sections.log_prefixes ?? []) as Entry[],
    logWindows: (sections.log_windows ?? []) as string[],
  };
}

function deriveLabel(toolPath: string): string {
  const name = path.basename(toolPath, path.extname(toolPath));
  return name.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function loadDashboardConfig(root: string): DashboardConfig {
  try {
    const raw = fs.readFileSync(path.join(root, "tools", "manifest.yaml"), "utf8");
    const m = parseManifest(raw);

    const actions: QuickAction[] = [];
    const ctxBin = path.join(root, "tools", ".venv", "bin", "ctx");
    for (const tool of m.tools) {
      if (tool.dashboard !== "actions") continue;
      const command = tool.path.startsWith("ctx")
        ? `${ctxBin} ${tool.path.slice(4).trim()}`
        : `./${tool.path}`;
      actions.push({
        label: tool.dashboard_label ?? deriveLabel(tool.path),
        command,
        icon: tool.dashboard_icon,
      });
    }
    for (const a of m.actions) {
      actions.push({ label: a.label, command: a.command, cwd: a.cwd, icon: a.icon });
    }

    const logSyncTool = m.tools.find((t) => t.path === "ctx cloudwatch groups");

    return {
      tests: m.tests.map((t): TestConfig => ({
        name: t.name,
        command: t.command,
        watchCommand: t.watch,
        cwd: t.cwd,
      })),
      actions,
      logPrefixes: m.logPrefixes.map((p): LogPrefix => ({ label: p.label, value: p.value })),
      logWindows: m.logWindows,
      logSyncLabel: logSyncTool?.dashboard_label,
    };
  } catch {
    return { tests: [], actions: [], logPrefixes: [], logWindows: [] };
  }
}

export function loadServiceDefinitions(root: string): Array<{ label: string; command: string; cwd: string; isBackground: boolean }> {
  const tasksPath = path.join(root, ".vscode", "tasks.json");
  try {
    const raw = fs.readFileSync(tasksPath, "utf8");
    const stripped = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,\s*([\]}])/g, "$1");
    const config = JSON.parse(stripped);
    return (config.tasks ?? [])
      .filter((t: Record<string, unknown>) => {
        const pres = t.presentation as Record<string, unknown> | undefined;
        return pres?.group === "services";
      })
      .map((t: Record<string, unknown>) => {
        const opts = t.options as Record<string, unknown> | undefined;
        const rawCwd = (opts?.cwd as string) ?? root;
        return {
          label: t.label as string,
          command: t.command as string,
          cwd: rawCwd.replace(/\$\{workspaceFolder\}/g, root),
          isBackground: (t.isBackground as boolean) ?? false,
        };
      });
  } catch {
    return [];
  }
}

export function registerConfigRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/config", async () => {
    return {
      dashboard: loadDashboardConfig(root),
      services: loadServiceDefinitions(root).map((d) => d.label),
    };
  });
}
