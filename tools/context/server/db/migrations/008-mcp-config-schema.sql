ALTER TABLE mcp_servers ADD COLUMN config_schema TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mcp_servers ADD COLUMN repo_url TEXT;
ALTER TABLE mcp_servers ADD COLUMN stars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mcp_servers ADD COLUMN avatar_url TEXT;
