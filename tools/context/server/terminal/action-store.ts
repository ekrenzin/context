/**
 * In-memory store for terminal actions -- sessions that need user attention.
 *
 * An action wraps a terminal session with metadata (title, description)
 * and a completion lifecycle.
 */

import { randomUUID } from "crypto";

export interface Action {
  id: string;
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string;
  title: string;
  description?: string;
  status: "pending" | "completed";
  createdAt: string;
  completedAt?: string;
}

export interface CreateActionInput {
  command: string;
  args?: string[];
  cwd?: string;
  title: string;
  description?: string;
}

const actions = new Map<string, Action>();

export function createAction(
  input: CreateActionInput,
  sessionId: string,
): Action {
  const action: Action = {
    id: randomUUID(),
    sessionId,
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    title: input.title,
    description: input.description,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  actions.set(action.id, action);
  return action;
}

export function completeAction(id: string): Action | undefined {
  const action = actions.get(id);
  if (!action || action.status === "completed") return undefined;
  action.status = "completed";
  action.completedAt = new Date().toISOString();
  return action;
}

export function getAction(id: string): Action | undefined {
  return actions.get(id);
}

export function listPendingActions(): Action[] {
  return [...actions.values()].filter((a) => a.status === "pending");
}
