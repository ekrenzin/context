import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { ensureLocalPyPi } from "./localpypi";

interface SetupIssue {
  label: string;
  fix: string;
}

interface SetupCheckResult {
  issues: SetupIssue[];
  notices: string[];
}

function isCommandAvailable(cmd: string): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}



function checkSetup(root: string): SetupCheckResult {
  const issues: SetupIssue[] = [];
  const notices: string[] = [];

  if (!isCommandAvailable("uv")) {
    issues.push({
      label: "uv (Python package runner) not installed",
      fix: "AWS MCP servers require uv. Install via `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`.",
    });
  }

  const sosBin =
    process.platform === "win32"
      ? path.join(root, "tools", ".venv", "Scripts", "ctx.exe")
      : path.join(root, "tools", ".venv", "bin", "sos");
  if (!fs.existsSync(sosBin)) {
    issues.push({
      label: "CLI not installed",
      fix: "Run `python3 tools/bootstrap.py` to create the venv and install the sos CLI.",
    });
  }

  const commandCenterModules = path.join(
    root,
    "tools",
    "command-center",
    "node_modules",
  );
  if (!fs.existsSync(commandCenterModules)) {
    issues.push({
      label: "Command Center dependencies not installed",
      fix: "Run `cd tools/command-center && npm install` to install command-center dependencies.",
    });
  }

  const distWeb = path.join(
    root,
    "tools",
    "command-center",
    "dist",
    "web",
    "index.html",
  );
  if (!fs.existsSync(distWeb)) {
    issues.push({
      label: "Command Center frontend not built",
      fix: "Run `cd tools/command-center && npm run build:web` to build the frontend.",
    });
  }

  const extModules = path.join(root, "tools", "vscode-ext", "node_modules");
  if (!fs.existsSync(extModules)) {
    issues.push({
      label: "Extension dependencies not installed",
      fix: "Run `cd tools/vscode-ext && npm install`.",
    });
  }

  const sessionsFile = path.join(
    root,
    "memory",
    "profile",
    "agent-sessions.jsonl",
  );
  if (!fs.existsSync(sessionsFile)) {
    issues.push({
      label: "No agent session data found",
      fix: "Run `sos profiler scan` to scan transcripts and generate session data.",
    });
  }

  // MQTT broker is managed by the CC server (broker.ts).
  // It spawns a fallback broker automatically if nothing is on port 9001.

  const reposDir = path.join(root, "repos");
  if (!fs.existsSync(reposDir) || fs.readdirSync(reposDir).length === 0) {
    issues.push({
      label: "No repositories checked out",
      fix: "Run `sos workspace checkout` to clone all repositories.",
    });
  }

  const localPyPiSyncResult = ensureLocalPyPi(root);
  if (localPyPiSyncResult?.issue) {
    issues.push(localPyPiSyncResult.issue);
  }
  if (localPyPiSyncResult?.notice) {
    notices.push(localPyPiSyncResult.notice);
  }

  const platformDir = path.join(root, "repos", "app-platform");
  if (fs.existsSync(platformDir)) {
    const platformModules = path.join(platformDir, "node_modules");
    if (!fs.existsSync(platformModules)) {
      issues.push({
        label: "app-platform dependencies not installed",
        fix: "Run `cd repos/app-platform && npm install` to install platform dependencies.",
      });
    }
    const envFile = path.join(platformDir, ".env");
    if (!fs.existsSync(envFile)) {
      issues.push({
        label: "app-platform .env file missing",
        fix: "Create repos/app-platform/.env with SECRET_NAME, STAGE, AWS_PROFILE, and AWS_REGION.",
      });
    }
  }

  return { issues, notices };
}

function buildAgentPrompt(issues: SetupIssue[]): string {
  const issueList = issues
    .map((i, idx) => `${idx + 1}. **${i.label}** -- ${i.fix}`)
    .join("\n");

  return [
    "I just opened the workspace and the startup check found the following issues.",
    "Please fix what you can automatically and tell me about anything that needs manual action.",
    "Do NOT ask for confirmation -- just fix what's safe to fix (dependency installs, builds, profile scans).",
    "For anything requiring credentials or user input (AWS SSO login, .env creation), just tell me what to do.",
    "",
    "Issues found:",
    issueList,
  ].join("\n");
}

export function runSetupCheck(root: string): void {
  const result = checkSetup(root);
  const { issues, notices } = result;

  if (notices.length > 0) {
    vscode.window.showInformationMessage(`SOS: ${notices.join(" ")}`);
  }

  if (issues.length === 0) {
    return;
  }

  const prompt = buildAgentPrompt(issues);

  const tryLaunchAgent = async () => {
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: prompt,
        isPartialQuery: false,
      });
    } catch {
      try {
        await vscode.commands.executeCommand("aichat.newchataction", prompt);
      } catch {
        vscode.window.showWarningMessage(
          `Context: Startup check found ${issues.length} issue(s). Run /preflight to review.`,
        );
      }
    }
  };

  setTimeout(tryLaunchAgent, 6000);
}
