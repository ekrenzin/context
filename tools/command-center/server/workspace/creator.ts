import fs from "fs";
import path from "path";
import type { WorkspaceConfig } from "./schema.js";

const DIRS = ["rules", "skills", "memory", "repos"];

const MEMORY_SUBDIRS = [
  "decisions",
  "known-issues",
  "progress",
  "preferences",
  "observations",
  "environment",
];

function writeYaml(filePath: string, config: WorkspaceConfig): void {
  const lines = [
    `name: ${config.name}`,
    `version: ${config.version}`,
    `appUrl: ${config.appUrl}`,
    `createdAt: ${config.createdAt ?? new Date().toISOString()}`,
    "",
    "ides:",
    ...config.ides.map((ide) => `  - ${ide}`),
    "",
    "repos:",
  ];

  for (const repo of config.repos) {
    lines.push(`  - name: ${repo.name}`);
    if (repo.url) lines.push(`    url: ${repo.url}`);
    if (repo.path) lines.push(`    path: ${repo.path}`);
    lines.push(`    branch: ${repo.branch}`);
    if (repo.description) lines.push(`    description: ${repo.description}`);
  }

  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

export function scaffoldWorkspace(root: string, config: WorkspaceConfig): void {
  for (const dir of DIRS) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }

  for (const sub of MEMORY_SUBDIRS) {
    const dir = path.join(root, "memory", sub);
    fs.mkdirSync(dir, { recursive: true });
    const gitkeep = path.join(dir, ".gitkeep");
    if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, "", "utf-8");
  }

  writeYaml(path.join(root, "workspace.yaml"), config);
}

export function readWorkspaceConfig(root: string): WorkspaceConfig | null {
  const filePath = path.join(root, "workspace.yaml");
  if (!fs.existsSync(filePath)) return null;

  const text = fs.readFileSync(filePath, "utf-8");
  return parseSimpleYaml(text);
}

function parseSimpleYaml(text: string): WorkspaceConfig {
  const config: Record<string, unknown> = {};
  const ides: string[] = [];
  const repos: Array<Record<string, string>> = [];
  let currentRepo: Record<string, string> | null = null;
  let inIdes = false;
  let inRepos = false;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed === "ides:") { inIdes = true; inRepos = false; continue; }
    if (trimmed === "repos:") { inRepos = true; inIdes = false; continue; }

    if (inIdes && trimmed.startsWith("- ")) {
      ides.push(trimmed.slice(2).trim());
      continue;
    }

    if (inRepos) {
      if (trimmed.startsWith("- name:")) {
        if (currentRepo) repos.push(currentRepo);
        currentRepo = { name: trimmed.slice(7).trim() };
        continue;
      }
      if (currentRepo && trimmed.includes(":")) {
        const [key, ...rest] = trimmed.split(":");
        currentRepo[key.trim()] = rest.join(":").trim();
        continue;
      }
    }

    if (!inIdes && !inRepos && trimmed.includes(":")) {
      const [key, ...rest] = trimmed.split(":");
      config[key.trim()] = rest.join(":").trim();
      inIdes = false;
      inRepos = false;
    }
  }
  if (currentRepo) repos.push(currentRepo);

  return {
    name: String(config.name ?? ""),
    version: 1,
    repos: repos.map((r) => ({
      name: r.name ?? "",
      url: r.url,
      path: r.path,
      branch: r.branch ?? "main",
      description: r.description ?? "",
    })),
    ides: ides as WorkspaceConfig["ides"],
    appUrl: String(config.appUrl ?? "http://127.0.0.1:19470"),
    createdAt: config.createdAt as string | undefined,
  };
}

export function workspaceExists(root: string): boolean {
  return fs.existsSync(path.join(root, "workspace.yaml"));
}
