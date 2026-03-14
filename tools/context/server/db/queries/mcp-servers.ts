import { getDb } from "../connection.js";
import type { ConfigField, McpServerRow, ProjectMcpServerRow } from "../types.js";

export interface McpServerInput {
  id: string;
  name: string;
  namespace: string;
  version?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled?: boolean;
  targets?: string[];
  configSchema?: ConfigField[];
  repoUrl?: string;
  stars?: number;
  avatarUrl?: string;
}

export function upsertMcpServer(input: McpServerInput): void {
  getDb()
    .prepare(
      `INSERT INTO mcp_servers
         (id, name, namespace, version, command, args, env, enabled, targets,
          config_schema, repo_url, stars, avatar_url)
       VALUES
         (@id, @name, @namespace, @version, @command, @args, @env, @enabled, @targets,
          @config_schema, @repo_url, @stars, @avatar_url)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, namespace=excluded.namespace, version=excluded.version,
         command=excluded.command, args=excluded.args, env=excluded.env,
         targets=excluded.targets, config_schema=excluded.config_schema,
         repo_url=excluded.repo_url, stars=excluded.stars, avatar_url=excluded.avatar_url,
         updated_at=datetime('now')`,
    )
    .run({
      id: input.id,
      name: input.name,
      namespace: input.namespace,
      version: input.version ?? "latest",
      command: input.command,
      args: JSON.stringify(input.args),
      env: JSON.stringify(input.env),
      enabled: input.enabled === false ? 0 : 1,
      targets: JSON.stringify(input.targets ?? ["claude-code", "cursor"]),
      config_schema: JSON.stringify(input.configSchema ?? []),
      repo_url: input.repoUrl ?? null,
      stars: input.stars ?? 0,
      avatar_url: input.avatarUrl ?? null,
    });
}

export function getMcpServer(id: string): McpServerRow | undefined {
  return getDb()
    .prepare("SELECT * FROM mcp_servers WHERE id = ?")
    .get(id) as McpServerRow | undefined;
}

export function listMcpServers(enabledOnly = false): McpServerRow[] {
  const where = enabledOnly ? "WHERE enabled = 1" : "";
  return getDb()
    .prepare(`SELECT * FROM mcp_servers ${where} ORDER BY namespace, name`)
    .all() as McpServerRow[];
}

export function toggleMcpServer(id: string, enabled: boolean): void {
  getDb()
    .prepare(
      "UPDATE mcp_servers SET enabled = @enabled, updated_at = datetime('now') WHERE id = @id",
    )
    .run({ id, enabled: enabled ? 1 : 0 });
}

export function updateMcpServerEnv(
  id: string,
  env: Record<string, string>,
): void {
  getDb()
    .prepare(
      "UPDATE mcp_servers SET env = @env, updated_at = datetime('now') WHERE id = @id",
    )
    .run({ id, env: JSON.stringify(env) });
}

export function deleteMcpServer(id: string): void {
  getDb().prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
}

export function countMcpServers(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM mcp_servers")
    .get() as { count: number };
  return row.count;
}

export interface ResolvedMcpServer extends McpServerRow {
  inherited: boolean;
  project_enabled: boolean;
  resolved_env: string;
}

export function getProjectMcpOverrides(projectId: string): ProjectMcpServerRow[] {
  return getDb()
    .prepare("SELECT * FROM project_mcp_servers WHERE project_id = ?")
    .all(projectId) as ProjectMcpServerRow[];
}

export function getResolvedServers(projectId: string): ResolvedMcpServer[] {
  const workspace = listMcpServers(false);
  const overrides = getProjectMcpOverrides(projectId);
  const overrideMap = new Map(overrides.map((o) => [o.server_id, o]));

  return workspace.map((s) => {
    const override = overrideMap.get(s.id);
    const wsEnv = JSON.parse(s.env) as Record<string, string>;
    const projEnv = override ? (JSON.parse(override.env) as Record<string, string>) : {};
    const merged = { ...wsEnv, ...projEnv };
    return {
      ...s,
      inherited: true,
      project_enabled: override ? !!override.enabled : !!s.enabled,
      resolved_env: JSON.stringify(merged),
    };
  });
}

export function setProjectMcpServer(
  projectId: string,
  serverId: string,
  opts: { enabled?: boolean; env?: Record<string, string> },
): void {
  const enabled = opts.enabled === undefined ? 1 : opts.enabled ? 1 : 0;
  const env = JSON.stringify(opts.env ?? {});
  getDb()
    .prepare(
      `INSERT INTO project_mcp_servers (project_id, server_id, enabled, env)
       VALUES (@project_id, @server_id, @enabled, @env)
       ON CONFLICT(project_id, server_id) DO UPDATE SET
         enabled = excluded.enabled, env = excluded.env,
         updated_at = datetime('now')`,
    )
    .run({ project_id: projectId, server_id: serverId, enabled, env });
}

export function removeProjectMcpServer(projectId: string, serverId: string): void {
  getDb()
    .prepare("DELETE FROM project_mcp_servers WHERE project_id = ? AND server_id = ?")
    .run(projectId, serverId);
}
