import { getDb } from "../connection.js";
import type { SettingRow } from "../types.js";

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value)
       VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET
         value=excluded.value, updated_at=datetime('now')`
    )
    .run({ key, value });
}

export function getSetting(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as Pick<SettingRow, "value"> | undefined;
  return row?.value;
}

export function getAllSettings(): SettingRow[] {
  return getDb()
    .prepare("SELECT * FROM settings ORDER BY key")
    .all() as SettingRow[];
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}
