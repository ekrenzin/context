import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { RepoEntry } from "../types.js";

function finalizeRepo(root: string, partial: Partial<RepoEntry>): RepoEntry {
  const name = partial.name ?? "";
  const repoDir = path.join(root, "repos", name);
  const present = fs.existsSync(repoDir);

  let installCommand: string | undefined;
  if (present) {
    if (fs.existsSync(path.join(repoDir, "package.json"))) {
      installCommand = "npm install";
    } else if (fs.existsSync(path.join(repoDir, "requirements.txt"))) {
      installCommand = "pip install -r requirements.txt";
    } else if (fs.existsSync(path.join(repoDir, "pyproject.toml"))) {
      installCommand = "pip install -e .";
    }
  }

  return {
    name,
    branch: partial.branch ?? "main",
    description: partial.description ?? "",
    installCommand,
    present,
  };
}

export function loadRepos(root: string): RepoEntry[] {
  try {
    const raw = fs.readFileSync(path.join(root, "repos.yaml"), "utf8");
    const entries: RepoEntry[] = [];
    let inRepos = false;
    let current: Partial<RepoEntry> | null = null;

    for (const line of raw.split("\n")) {
      if (/^repositories:\s*$/.test(line)) { inRepos = true; continue; }
      if (!inRepos) continue;

      const itemMatch = line.match(/^\s+-\s+name:\s*(.+)/);
      if (itemMatch) {
        if (current?.name) entries.push(finalizeRepo(root, current));
        current = { name: itemMatch[1].trim() };
        continue;
      }
      if (!current) continue;

      const branchMatch = line.match(/^\s+branch:\s*(.+)/);
      if (branchMatch) current.branch = branchMatch[1].trim();
      const descMatch = line.match(/^\s+description:\s*(.+)/);
      if (descMatch) current.description = descMatch[1].trim();
    }
    if (current?.name) entries.push(finalizeRepo(root, current));
    return entries;
  } catch {
    return [];
  }
}

export function registerRepoRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/repos", async () => {
    return loadRepos(root);
  });
}
