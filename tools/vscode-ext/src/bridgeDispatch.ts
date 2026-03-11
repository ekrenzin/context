import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { BridgeTasks } from "./bridgeTasks";
import type { WSMessage } from "./bridgeTypes";

interface DispatchDeps {
  readonly root: string;
  readonly tasks: BridgeTasks;
}

export async function dispatchBridgeCommand(msg: WSMessage, deps: DispatchDeps): Promise<void> {
  const type = msg.type as string;
  if (!type) return;

  switch (type) {
    case "vscode:startTask":
      return deps.tasks.startTask(msg.label as string);

    case "vscode:stopTask":
      deps.tasks.stopTask(msg.label as string);
      return;

    case "vscode:startAll":
      await deps.tasks.startAllLabels();
      return;

    case "vscode:stopAll":
      deps.tasks.stopAllTasks();
      return;

    case "vscode:restartTask":
      return deps.tasks.restartTask(msg.label as string);

    case "vscode:restartAll":
      return deps.tasks.restartAllTasks();

    case "vscode:openTerminal":
      deps.tasks.openTerminal(
        (msg.name as string) ?? "Context",
        msg.command as string,
        msg.cwd ? path.join(deps.root, msg.cwd as string) : deps.root,
        (msg.fresh as boolean) ?? false,
      );
      return;

    case "vscode:copyText":
      await vscode.env.clipboard.writeText(msg.text as string);
      vscode.window.showInformationMessage("Copied to clipboard");
      return;

    case "vscode:openChat":
      try {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: msg.query as string,
          isPartialQuery: false,
        });
      } catch {
        try {
          await vscode.commands.executeCommand("aichat.newchataction", msg.query as string);
        } catch {
          // no chat provider available
        }
      }
      return;

    case "vscode:pullRepo": {
      const name = msg.name as string;
      deps.tasks.openTerminal(`Context: Pull ${name}`, "git pull", deps.tasks.repoPath(name), true);
      return;
    }

    case "vscode:installDeps": {
      const name = msg.name as string;
      const repoDir = deps.tasks.repoPath(name);
      let command: string | undefined;
      if (fs.existsSync(path.join(repoDir, "package.json"))) command = "npm install";
      else if (fs.existsSync(path.join(repoDir, "requirements.txt"))) command = "pip install -r requirements.txt";
      else if (fs.existsSync(path.join(repoDir, "pyproject.toml"))) command = "pip install -e .";
      if (command) deps.tasks.openTerminal(`Context: Install ${name}`, command, repoDir, true);
      return;
    }

    case "vscode:runTest": {
      const testName = msg.name as string;
      const watch = msg.watch as boolean;
      const testCase = deps.tasks.loadTests().find((candidate) => candidate.name === testName);
      if (!testCase) return;
      const cwd = path.join(deps.root, testCase.cwd);
      const command = watch && testCase.watchCommand ? testCase.watchCommand : testCase.command;
      deps.tasks.openTerminal(`Context: Test ${testCase.name}`, command, cwd, true);
      return;
    }

    case "vscode:openLogs":
      return deps.tasks.openLogs(
        msg.prefix as string,
        msg.since as string,
        (msg.filter as string) ?? "",
        msg.tail as boolean,
      );

    case "vscode:profileScan": {
      const sosCmd = path.join(deps.root, "tools", ".venv", "bin", "sos");
      deps.tasks.openTerminal("Context: Profile Scan", `${sosCmd} profiler scan`, deps.root);
      return;
    }

    case "vscode:profileReport": {
      const sosCmd = path.join(deps.root, "tools", ".venv", "bin", "sos");
      deps.tasks.openTerminal("Context: Profile Report", `${sosCmd} profiler report --top 15`, deps.root);
      return;
    }

    case "vscode:analyzeSession": {
      const chatId = msg.chatId as string;
      if (!chatId) return;
      const sosCmd = path.join(deps.root, "tools", ".venv", "bin", "sos");
      deps.tasks.openTerminal(
        `Context: Analyze ${chatId.slice(0, 8)}`,
        `${sosCmd} profiler analyze --chat-id ${chatId} --force`,
        deps.root,
        true,
      );
      return;
    }

    case "vscode:analyzeAll": {
      const sosCmd = path.join(deps.root, "tools", ".venv", "bin", "sos");
      deps.tasks.openTerminal("Context: Analyze", `${sosCmd} profiler analyze`, deps.root);
      return;
    }
  }
}
