import { getDb } from "../connection.js";
import type { TranscriptRow } from "../types.js";

export function upsertTranscript(chatId: string, content: string): void {
  getDb()
    .prepare(
      `INSERT INTO transcripts (chat_id, content)
       VALUES (@chat_id, @content)
       ON CONFLICT(chat_id) DO UPDATE SET
         content=excluded.content, imported_at=datetime('now')`
    )
    .run({ chat_id: chatId, content });
}

export function getTranscript(chatId: string): TranscriptRow | undefined {
  return getDb()
    .prepare("SELECT * FROM transcripts WHERE chat_id = ?")
    .get(chatId) as TranscriptRow | undefined;
}

export function deleteTranscript(chatId: string): void {
  getDb().prepare("DELETE FROM transcripts WHERE chat_id = ?").run(chatId);
}

export function transcriptExists(chatId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM transcripts WHERE chat_id = ? LIMIT 1")
    .get(chatId);
  return row !== undefined;
}
