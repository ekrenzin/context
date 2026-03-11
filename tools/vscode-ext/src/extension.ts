import * as vscode from "vscode";
import { DashboardServerManager } from "./dashboardServer";
import { ServicesTreeProvider } from "./servicesView";
import { MqttEventStore } from "./mqttEvents";
import { runSetupCheck } from "./setup";

let manager: DashboardServerManager | null = null;

function getRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath ?? "";
}

function getPort(): number {
  return vscode.workspace
    .getConfiguration("ctx")
    .get<number>("dashboardPort", 19470);
}

function getWebPort(): number {
  return vscode.workspace
    .getConfiguration("ctx")
    .get<number>("dashboardWebPort", 19471);
}

function getLiveReload(): boolean {
  return vscode.workspace
    .getConfiguration("ctx")
    .get<boolean>("dashboardLiveReload", true);
}

function getThemeKind(): "light" | "dark" {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? "light"
    : "dark";
}

function getManager(): DashboardServerManager {
  if (!manager) {
    manager = new DashboardServerManager({ getRoot, getPort, getWebPort, getLiveReload });
  }
  return manager;
}

async function openDashboard(): Promise<void> {
  const root = getRoot();
  if (!root) {
    vscode.window.showWarningMessage("Context: No workspace folder found.");
    return;
  }

  const theme = getThemeKind();

  try {
    await getManager().openDashboard(theme);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Context: Failed to open dashboard. ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const serverManager = getManager();
  const treeProvider = new ServicesTreeProvider(serverManager);

  const mqttStore = new MqttEventStore();
  serverManager.setMqttStore(mqttStore);
  treeProvider.setMqttStore(mqttStore);

  context.subscriptions.push(
    vscode.commands.registerCommand("ctx.openDashboard", openDashboard),
    vscode.commands.registerCommand("ctx.startDashboardServer", async () => {
      try {
        await serverManager.start();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Context: Failed to start dashboard server. ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand("ctx.stopDashboardServer", () => {
      serverManager.stop();
    }),
    vscode.commands.registerCommand("ctx.restartDashboardServer", async () => {
      try {
        await serverManager.restart();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Context: Failed to restart dashboard server. ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand("ctx.clearMqttEvents", () => {
      mqttStore.clear();
    }),
  );

  const launcherTree = vscode.window.createTreeView("ctxLauncherView", {
    treeDataProvider: treeProvider,
  });
  context.subscriptions.push(launcherTree);

  context.subscriptions.push({
    dispose: () => serverManager.dispose(),
  });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      // Future: notify browser of theme change via WebSocket
    }),
  );

  const autoOpen = vscode.workspace
    .getConfiguration("ctx")
    .get<boolean>("autoOpenDashboard", true);

  if (autoOpen) {
    const open = () => {
      openDashboard().catch((err) => {
        console.error("[Context] Auto-open failed:", err);
        setTimeout(open, 5000);
      });
    };
    setTimeout(open, 3000);
  }

  const autoSetup = vscode.workspace
    .getConfiguration("ctx")
    .get<boolean>("autoSetupCheck", true);

  if (autoSetup) {
    const root = getRoot();
    if (root) {
      setTimeout(() => runSetupCheck(root), 5000);
    }
  }
}

export function deactivate(): void {
  manager?.dispose();
  manager = null;
}
