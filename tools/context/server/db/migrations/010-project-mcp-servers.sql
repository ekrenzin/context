CREATE TABLE IF NOT EXISTS project_mcp_servers (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  server_id   TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  enabled     INTEGER NOT NULL DEFAULT 1,
  env         TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_project_mcp_project ON project_mcp_servers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_mcp_server ON project_mcp_servers(server_id);
