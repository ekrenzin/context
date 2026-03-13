-- feed_events: per-project activity stream
CREATE TABLE IF NOT EXISTS feed_events (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL CHECK(type IN (
                'session_analyzed','skill_proposed','memory_written',
                'pattern_detected','approval_resolved','workspace_synced'
              )),
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_project ON feed_events(project_id);
CREATE INDEX IF NOT EXISTS idx_feed_type ON feed_events(type);
CREATE INDEX IF NOT EXISTS idx_feed_created ON feed_events(created_at);
