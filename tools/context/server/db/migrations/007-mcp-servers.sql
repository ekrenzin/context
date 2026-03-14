CREATE TABLE IF NOT EXISTS mcp_servers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  namespace   TEXT NOT NULL,
  version     TEXT NOT NULL DEFAULT 'latest',
  command     TEXT NOT NULL,
  args        TEXT NOT NULL DEFAULT '[]',
  env         TEXT NOT NULL DEFAULT '{}',
  enabled     INTEGER NOT NULL DEFAULT 1,
  targets     TEXT NOT NULL DEFAULT '["claude-code","cursor"]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mcp_servers_namespace ON mcp_servers(namespace);
CREATE INDEX idx_mcp_servers_enabled ON mcp_servers(enabled);
