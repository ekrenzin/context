CREATE TABLE IF NOT EXISTS dispatch_log (
  id TEXT PRIMARY KEY,
  input TEXT NOT NULL,
  intent TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  skills TEXT NOT NULL DEFAULT '[]',
  repo TEXT,
  agent TEXT NOT NULL DEFAULT 'claude',
  command TEXT NOT NULL,
  cross_repo INTEGER NOT NULL DEFAULT 0,
  cross_repo_detail TEXT,
  skill_gaps TEXT,
  memory_updated INTEGER NOT NULL DEFAULT 0,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  analysis_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  analyzed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dispatch_log_created ON dispatch_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_intent ON dispatch_log(intent);
