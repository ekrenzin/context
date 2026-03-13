import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let instance: Database.Database | null = null;

function resolveDbPath(root: string): string {
  const dataDir = path.join(root, ".ctx");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "context.db");
}

export function openDb(root: string): Database.Database {
  if (instance) return instance;

  const dbPath = resolveDbPath(root);
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  instance = db;
  return db;
}

export function getDb(): Database.Database {
  if (!instance) {
    throw new Error("Database not initialized -- call openDb(root) first");
  }
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
