-- approvals: queued proposals from the synthesizer awaiting user review
CREATE TABLE IF NOT EXISTS approvals (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL CHECK(type IN (
                'skill_evolution','memory_candidate','rule_change'
              )),
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  diff        TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','approved','rejected','expired')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
