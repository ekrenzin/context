import { getDb } from "../connection.js";
import { randomUUID } from "crypto";

export interface ConversationRow {
  id: string;
  title: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_results: string | null;
  created_at: string;
}

export function createConversation(model?: string): ConversationRow {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO conversations (id, model) VALUES (?, ?)")
    .run(id, model ?? null);
  return getConversation(id)!;
}

export function listConversations(limit = 50): ConversationRow[] {
  return getDb()
    .prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as ConversationRow[];
}

export function getConversation(id: string): ConversationRow | undefined {
  return getDb()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;
}

export function updateConversation(id: string, fields: { title?: string; model?: string }): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: Record<string, unknown> = { id };
  if (fields.title !== undefined) {
    sets.push("title = @title");
    params.title = fields.title;
  }
  if (fields.model !== undefined) {
    sets.push("model = @model");
    params.model = fields.model;
  }
  getDb()
    .prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = @id`)
    .run(params);
}

export function deleteConversation(id: string): void {
  getDb().prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

export function appendMessage(
  conversationId: string,
  role: string,
  content: string,
  toolCalls?: unknown[],
  toolResults?: unknown[],
): MessageRow {
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO conversation_messages (conversation_id, role, content, tool_calls, tool_results)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      conversationId,
      role,
      content,
      toolCalls ? JSON.stringify(toolCalls) : null,
      toolResults ? JSON.stringify(toolResults) : null,
    );
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
  return db
    .prepare("SELECT * FROM conversation_messages WHERE id = ?")
    .get(res.lastInsertRowid) as MessageRow;
}

export function getMessages(conversationId: string): MessageRow[] {
  return getDb()
    .prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id")
    .all(conversationId) as MessageRow[];
}
