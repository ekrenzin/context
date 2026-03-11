import * as fs from "fs";
import * as path from "path";
import type { DashboardTestCase, ServiceDefinition } from "./bridgeTypes";

export function loadServiceDefinitions(root: string): ServiceDefinition[] {
  const tasksPath = path.join(root, ".vscode", "tasks.json");
  try {
    const raw = fs.readFileSync(tasksPath, "utf8");
    const stripped = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,\s*([\]}])/g, "$1");
    const config = JSON.parse(stripped);
    return (config.tasks ?? [])
      .filter((task: Record<string, unknown>) => {
        const presentation = task.presentation as Record<string, unknown> | undefined;
        return presentation?.group === "services";
      })
      .map((task: Record<string, unknown>) => {
        const options = task.options as Record<string, unknown> | undefined;
        const rawCwd = (options?.cwd as string) ?? root;
        return {
          label: task.label as string,
          command: task.command as string,
          cwd: rawCwd.replace(/\$\{workspaceFolder\}/g, root),
          isBackground: (task.isBackground as boolean) ?? false,
        };
      });
  } catch {
    return [];
  }
}

export function loadDashboardTests(root: string): DashboardTestCase[] {
  try {
    const raw = fs.readFileSync(path.join(root, "tools", "manifest.yaml"), "utf8");
    const tests: DashboardTestCase[] = [];
    let inTests = false;
    let current: Record<string, string> | null = null;

    for (const line of raw.split("\n")) {
      if (/^tests:\s*$/.test(line)) {
        inTests = true;
        continue;
      }
      if (/^\w/.test(line) && inTests) {
        inTests = false;
        continue;
      }
      if (!inTests) continue;

      const dashMatch = line.match(/^\s+-\s+(\w+):\s*(.+)/);
      if (dashMatch) {
        if (current?.name) {
          tests.push({
            name: current.name,
            command: current.command ?? "",
            watchCommand: current.watch,
            cwd: current.cwd ?? ".",
          });
        }
        current = { [dashMatch[1]]: dashMatch[2].trim() };
        continue;
      }
      const continuationMatch = line.match(/^\s+(\w+):\s*(.+)/);
      if (continuationMatch && current) {
        current[continuationMatch[1]] = continuationMatch[2].trim();
      }
    }

    if (current?.name) {
      tests.push({
        name: current.name,
        command: current.command ?? "",
        watchCommand: current.watch,
        cwd: current.cwd ?? ".",
      });
    }
    return tests;
  } catch {
    return [];
  }
}
