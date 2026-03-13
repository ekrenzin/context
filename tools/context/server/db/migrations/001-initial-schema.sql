-- sessions: parsed transcript metadata + analysis results
CREATE TABLE IF NOT EXISTS sessions (
  chat_id          TEXT PRIMARY KEY,
  title            TEXT NOT NULL DEFAULT '',
  summary          TEXT NOT NULL DEFAULT '',
  verdict          TEXT NOT NULL DEFAULT '',
  first_query      TEXT NOT NULL DEFAULT '',
  date             TEXT NOT NULL,
  timestamp        TEXT NOT NULL,
  file_bytes       INTEGER NOT NULL DEFAULT 0,
  user_turns       INTEGER NOT NULL DEFAULT 0,
  assistant_turns  INTEGER NOT NULL DEFAULT 0,
  total_calls      INTEGER NOT NULL DEFAULT 0,
  tools            TEXT NOT NULL DEFAULT '{}',
  skills           TEXT NOT NULL DEFAULT '[]',
  skill_counts     TEXT NOT NULL DEFAULT '{}',
  subagent_types   TEXT NOT NULL DEFAULT '{}',
  plan_mode        INTEGER NOT NULL DEFAULT 0,
  thinking_blocks  INTEGER NOT NULL DEFAULT 0,
  response_chars_total INTEGER NOT NULL DEFAULT 0,
  response_chars_avg   INTEGER NOT NULL DEFAULT 0,
  response_chars_max   INTEGER NOT NULL DEFAULT 0,
  analysis         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_verdict ON sessions(verdict);

-- analytics: daily aggregate snapshots
CREATE TABLE IF NOT EXISTS analytics (
  date               TEXT PRIMARY KEY,
  total_sessions     INTEGER NOT NULL DEFAULT 0,
  analyzed_sessions  INTEGER NOT NULL DEFAULT 0,
  productive_rate    REAL NOT NULL DEFAULT 0,
  avg_efficiency     REAL NOT NULL DEFAULT 0,
  current_streak     INTEGER NOT NULL DEFAULT 0,
  best_streak        INTEGER NOT NULL DEFAULT 0,
  total_tool_calls   INTEGER NOT NULL DEFAULT 0,
  unique_skills      INTEGER NOT NULL DEFAULT 0,
  avg_turns          REAL NOT NULL DEFAULT 0,
  activity_map       TEXT NOT NULL DEFAULT '{}',
  trends             TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- memory: persistent cross-session knowledge
CREATE TABLE IF NOT EXISTS memory (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN (
                'progress','decision','known-issue','preference','observation'
              )),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  repo        TEXT,
  ticket      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
CREATE INDEX IF NOT EXISTS idx_memory_repo ON memory(repo);

-- transcripts: raw session transcript content
CREATE TABLE IF NOT EXISTS transcripts (
  chat_id      TEXT PRIMARY KEY REFERENCES sessions(chat_id),
  content      TEXT NOT NULL,
  imported_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- learning: patterns discovered by the profiler / AI engine
CREATE TABLE IF NOT EXISTS learning (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN (
                'skill-gap','pattern','recommendation','evolution'
              )),
  source      TEXT,
  content     TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_type ON learning(type);
CREATE INDEX IF NOT EXISTS idx_learning_source ON learning(source);

-- settings: key-value application configuration
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
