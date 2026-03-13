import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function ensureMetaTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function appliedSet(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT name FROM _migrations ORDER BY id")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function pendingFiles(applied: Set<string>): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort();
}

export function migrate(db: Database.Database): { applied: string[] } {
  ensureMetaTable(db);

  const applied = appliedSet(db);
  const pending = pendingFiles(applied);
  const results: string[] = [];

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    })();

    results.push(file);
  }

  return { applied: results };
}
