import * as fs from "fs";
import * as path from "path";

interface SetupIssueLike {
  label: string;
  fix: string;
}

export interface LocalPyPiSyncResult {
  notice?: string;
  issue?: SetupIssueLike;
}

function parseLocalPyPi(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  );
}

function hasSameValues(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const item of left) {
    if (!right.has(item)) {
      return false;
    }
  }
  return true;
}

function discoverLocalPyPiProjects(root: string): Set<string> {
  const reposDir = path.join(root, "repos");
  if (!fs.existsSync(reposDir)) {
    return new Set();
  }
  const projects = new Set<string>();
  for (const entry of fs.readdirSync(reposDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pyprojectPath = path.join(reposDir, entry.name, "pyproject.toml");
    if (!fs.existsSync(pyprojectPath)) {
      continue;
    }
    projects.add(entry.name.trim().replace(/-/g, "_"));
  }
  return projects;
}

function readEnvKey(envFile: string, key: string): string | null {
  const prefix = `${key}=`;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

function upsertEnvKey(envFile: string, key: string, value: string): void {
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  const keyPrefix = `${key}=`;
  const nextLines: string[] = [];
  let updated = false;

  for (const line of lines) {
    if (line.startsWith(keyPrefix)) {
      nextLines.push(`${key}=${value}`);
      updated = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!updated) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim() !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${value}`);
  }

  const output = `${nextLines.join("\n").replace(/\n*$/, "")}\n`;
  fs.writeFileSync(envFile, output, "utf8");
}

export function ensureLocalPyPi(root: string): LocalPyPiSyncResult | null {
  const repoProjects = discoverLocalPyPiProjects(root);
  if (repoProjects.size === 0) {
    return null;
  }

  const envFile = path.join(root, ".env");
  if (!fs.existsSync(envFile)) {
    return {
      issue: {
        label: "Workspace .env file missing",
        fix: "Create the workspace .env file so startup can set LOCALPYPI automatically.",
      },
    };
  }

  const desiredValue = Array.from(repoProjects).sort().join(",");
  let configured: string | null;
  try {
    configured = readEnvKey(envFile, "LOCALPYPI");
  } catch (error) {
    return {
      issue: {
        label: "Unable to read workspace .env for LOCALPYPI sync",
        fix: `Ensure ${envFile} is readable by your user, then restart Cursor. (${error instanceof Error ? error.message : String(error)})`,
      },
    };
  }
  if (configured === null) {
    try {
      upsertEnvKey(envFile, "LOCALPYPI", desiredValue);
    } catch (error) {
      return {
        issue: {
          label: "Failed to add LOCALPYPI to workspace .env",
          fix: `Ensure ${envFile} is writable by your user, then restart Cursor. (${error instanceof Error ? error.message : String(error)})`,
        },
      };
    }
    return {
      notice: "Updated workspace .env: added LOCALPYPI from Python repos.",
    };
  }

  const configuredProjects = parseLocalPyPi(configured);
  if (hasSameValues(configuredProjects, repoProjects)) {
    return null;
  }

  try {
    upsertEnvKey(envFile, "LOCALPYPI", desiredValue);
  } catch (error) {
    return {
      issue: {
        label: "Failed to sync LOCALPYPI in workspace .env",
        fix: `Ensure ${envFile} is writable by your user, then restart Cursor. (${error instanceof Error ? error.message : String(error)})`,
      },
    };
  }
  return {
    notice: "Updated workspace .env: synced LOCALPYPI with Python repos.",
  };
}
