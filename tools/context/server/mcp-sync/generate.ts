import fs from "fs";
import path from "path";
import { listMcpServers, getResolvedServers } from "../db/queries/mcp-servers.js";
import { listProjects } from "../db/queries/index.js";
import type { McpServerRow } from "../db/types.js";

interface McpConfig {
  mcpServers: Record<
    string,
    { command: string; args: string[]; env?: Record<string, string> }
  >;
}

interface ResolvedLike {
  command: string;
  args: string;
  name: string;
  resolved_env?: string;
  env: string;
  targets: string;
  project_enabled?: boolean;
  enabled: number;
}

function buildConfig(servers: ResolvedLike[], useResolved = false): McpConfig {
  const mcpServers: McpConfig["mcpServers"] = {};
  for (const s of servers) {
    const enabled = useResolved
      ? (s.project_enabled ?? !!s.enabled)
      : !!s.enabled;
    if (!enabled) continue;
    const args = JSON.parse(s.args) as string[];
    const envStr = useResolved && s.resolved_env ? s.resolved_env : s.env;
    const env = JSON.parse(envStr) as Record<string, string>;
    const key = s.name.toLowerCase().replace(/\s+/g, "-");
    mcpServers[key] = { command: s.command, args };
    if (Object.keys(env).length > 0) {
      mcpServers[key].env = env;
    }
  }
  return { mcpServers };
}

function hasTarget(row: { targets: string }, target: string): boolean {
  const targets = JSON.parse(row.targets) as string[];
  return targets.includes(target);
}

function writeIfChanged(filePath: string, content: string): boolean {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (existing === content) return false;
  }
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

function writeTargetConfigs(
  root: string,
  servers: ResolvedLike[],
  useResolved: boolean,
  written: string[],
): void {
  const claude = servers.filter((s) => hasTarget(s, "claude-code"));
  const claudeConfig = buildConfig(claude, useResolved);
  const claudePath = path.join(root, ".mcp.json");
  if (writeIfChanged(claudePath, JSON.stringify(claudeConfig, null, 2) + "\n")) {
    written.push(claudePath);
  }

  const cursor = servers.filter((s) => hasTarget(s, "cursor"));
  const cursorConfig = buildConfig(cursor, useResolved);
  const cursorPath = path.join(root, ".cursor", "mcp.json");
  if (writeIfChanged(cursorPath, JSON.stringify(cursorConfig, null, 2) + "\n")) {
    written.push(cursorPath);
  }
}

export function generateConfigs(root: string): { written: string[] } {
  const all = listMcpServers(true);
  const written: string[] = [];

  // Workspace-level configs at workspace root
  writeTargetConfigs(root, all, false, written);

  // Per-project configs
  try {
    const projects = listProjects({ status: "active" });
    for (const p of projects) {
      if (!p.root_path || !fs.existsSync(p.root_path)) continue;
      const resolved = getResolvedServers(p.id);
      writeTargetConfigs(p.root_path, resolved, true, written);
    }
  } catch {
    // projects table may not exist yet during initial migration
  }

  return { written };
}
