CREATE TABLE IF NOT EXISTS solutions (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  problem      TEXT NOT NULL,
  project_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','active','stopped','error')),
  components   TEXT NOT NULL DEFAULT '[]',
  usage_count  INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_solutions_project ON solutions(project_id);
CREATE INDEX IF NOT EXISTS idx_solutions_status ON solutions(status);
