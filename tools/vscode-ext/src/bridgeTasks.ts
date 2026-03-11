import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ServicePty } from "./service-pty.js";
import { loadDashboardTests, loadServiceDefinitions } from "./bridgeConfig";
import { SERVICE_TERMINAL_GROUP, STATUS_TOPIC } from "./bridgeTypes";

export class BridgeTasks {
  private serviceDefinitions = loadServiceDefinitions(this.root);
  private serviceLabels = this.serviceDefinitions.map((service) => service.label);

  public constructor(
    private readonly root: string,
    private readonly publishRaw: (topic: string, payload: string) => void,
  ) {}

  public getLabels(): string[] {
    return [...this.serviceLabels];
  }

  public async startTask(label: string): Promise<void> {
    const definition = this.serviceDefinitions.find((service) => service.label === label);

    if (!definition) {
      const tasks = await vscode.tasks.fetchTasks();
      const fallback = tasks.find(
        (task) => task.name === label || task.name === `${label} (${task.source})`,
      );
      if (fallback) await vscode.tasks.executeTask(fallback);
      return;
    }

    const folder = vscode.workspace.workspaceFolders?.[0];
    const scope = folder ?? vscode.TaskScope.Workspace;
    const execution = new vscode.CustomExecution(async () => {
      return new ServicePty(definition.command, definition.cwd, (entry) => {
        this.publishRaw(`ctx/logs/${entry.levelName}`, JSON.stringify(entry));
      });
    });
    const task = new vscode.Task(
      { type: "ctx-service", service: label },
      scope,
      label,
      "Context",
      execution,
    );
    task.isBackground = definition.isBackground;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Silent,
      panel: vscode.TaskPanelKind.Dedicated,
    };
    (task.presentationOptions as vscode.TaskPresentationOptions & { group?: string }).group =
      SERVICE_TERMINAL_GROUP;
    await vscode.tasks.executeTask(task);
  }

  public stopTask(label: string): void {
    const execution = [...vscode.tasks.taskExecutions].find((taskExecution) => taskExecution.task.name === label);
    if (execution) {
      execution.terminate();
      return;
    }
    this.disposeTaskTerminal(label);
  }

  public stopAllTasks(): void {
    const labels = new Set(this.serviceLabels);
    for (const execution of [...vscode.tasks.taskExecutions]) {
      if (labels.has(execution.task.name)) {
        execution.terminate();
      }
    }
  }

  public async restartTask(label: string): Promise<void> {
    const existingExecution = [...vscode.tasks.taskExecutions].find(
      (execution) => execution.task.name === label,
    );

    if (existingExecution) {
      existingExecution.terminate();
      await this.waitForTaskEnd(label, 5000);
    }

    const stillRunning = vscode.tasks.taskExecutions.some((execution) => execution.task.name === label);
    if (stillRunning || existingExecution) {
      this.disposeTaskTerminal(label);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await this.startTask(label);
  }

  public async restartAllTasks(): Promise<void> {
    const runningLabels = this.serviceLabels.filter((label) =>
      vscode.tasks.taskExecutions.some((execution) => execution.task.name === label),
    );
    this.stopAllTasks();
    await Promise.all(runningLabels.map((label) => this.waitForTaskEnd(label)));
    for (const label of this.serviceLabels) {
      await this.startTask(label);
    }
  }

  public openTerminal(name: string, command: string, cwd: string, fresh = false): void {
    let terminal = vscode.window.terminals.find((candidate) => candidate.name === name);
    if (terminal && fresh) {
      terminal.dispose();
      terminal = undefined;
    }
    if (!terminal) {
      const parentTerminal = vscode.window.activeTerminal ?? vscode.window.terminals.at(-1);
      terminal = vscode.window.createTerminal({
        name,
        cwd,
        location: parentTerminal ? { parentTerminal } : undefined,
      });
    }
    terminal.show(false);
    terminal.sendText(command);
  }

  public async openLogs(prefix: string, since: string, filter: string, tail: boolean): Promise<void> {
    const filterFlag = filter ? ` --filter "${filter}"` : "";

    if (!tail) {
      const sosCmd = path.join(this.root, "tools", ".venv", "bin", "sos");
      const command = `${sosCmd} cloudwatch insights --prefix "${prefix}" --since ${since}${filterFlag}`;
      this.openTerminal("Context: CloudWatch Logs", command, this.root);
      return;
    }

    const groupsFile = path.join(this.root, "context", "cloudwatch", "groups.txt");
    try {
      const content = fs.readFileSync(groupsFile, "utf8");
      const groups = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#") && line.startsWith(prefix));

      if (groups.length === 0) throw new Error("no matching groups");

      const group = groups.length === 1
        ? groups[0]
        : await vscode.window.showQuickPick(groups, { placeHolder: "Select log group to tail" });
      if (!group) return;

      const sosCmd = path.join(this.root, "tools", ".venv", "bin", "sos");
      const command = `${sosCmd} cloudwatch tail "${group}" --since ${since}${filterFlag}`;
      this.openTerminal("Context: CloudWatch Tail", command, this.root, true);
    } catch {
      vscode.window.showWarningMessage("No cached log groups found. Falling back to insights query.");
      const sosCmd = path.join(this.root, "tools", ".venv", "bin", "sos");
      const command = `${sosCmd} cloudwatch insights --prefix "${prefix}" --since ${since}${filterFlag}`;
      this.openTerminal("Context: CloudWatch Logs", command, this.root);
    }
  }

  public startAllLabels(): Promise<void[]> {
    return Promise.all(this.serviceLabels.map((label) => this.startTask(label)));
  }

  public sendServiceStatus(publish: (topic: string, message: Record<string, unknown>) => void): void {
    const running = vscode.tasks.taskExecutions.map((execution) => execution.task.name);
    publish(STATUS_TOPIC, {
      status: "online",
      type: "vscode:serviceStatus",
      running,
    });
  }

  public loadTests() {
    return loadDashboardTests(this.root);
  }

  public repoPath(name: string): string {
    return path.join(this.root, "repos", name);
  }

  private disposeTaskTerminal(label: string): void {
    for (const terminal of vscode.window.terminals) {
      if (terminal.name === label || terminal.name === `Task - ${label}`) {
        terminal.dispose();
        return;
      }
    }
  }

  private waitForTaskEnd(label: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve) => {
      const isRunning = () => vscode.tasks.taskExecutions.some((execution) => execution.task.name === label);
      if (!isRunning()) {
        resolve();
        return;
      }

      const disposable = vscode.tasks.onDidEndTask((event) => {
        if (event.execution.task.name === label) {
          disposable.dispose();
          clearTimeout(timer);
          resolve();
        }
      });
      const timer = setTimeout(() => {
        disposable.dispose();
        resolve();
      }, timeoutMs);
    });
  }
}
