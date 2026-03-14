-- Widen the memory type CHECK constraint to match VALID_TYPES in code.
-- SQLite requires table recreation to alter CHECK constraints.

CREATE TABLE IF NOT EXISTS memory_new (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN (
                'progress','decision','known-issue','preference','observation',
                'decisions','known-issues','preferences','observations','environment'
              )),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  repo        TEXT,
  ticket      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO memory_new
  SELECT * FROM memory;

DROP TABLE memory;
ALTER TABLE memory_new RENAME TO memory;

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
CREATE INDEX IF NOT EXISTS idx_memory_repo ON memory(repo);
