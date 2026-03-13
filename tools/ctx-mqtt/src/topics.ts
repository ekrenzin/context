const PREFIX = "ctx";

export const TOPICS = {
  status: `${PREFIX}/status`,
  tasks: {
    status: `${PREFIX}/tasks/status`,
    progress: `${PREFIX}/tasks/progress`,
    complete: `${PREFIX}/tasks/complete`,
  },
  analysis: {
    started: `${PREFIX}/analysis/started`,
    complete: `${PREFIX}/analysis/complete`,
    error: `${PREFIX}/analysis/error`,
  },
  workspace: {
    sync: `${PREFIX}/workspace/sync`,
    adapted: `${PREFIX}/workspace/adapted`,
    changed: `${PREFIX}/workspace/changed`,
  },
  session: {
    /** ctx/session/<id>/output — live terminal output chunks */
    output: (id: string) => `${PREFIX}/session/${id}/output`,
    /** ctx/session/<id>/started — published when a session is spawned */
    started: (id: string) => `${PREFIX}/session/${id}/started`,
    /** ctx/session/<id>/exited — published when the process exits */
    exited: (id: string) => `${PREFIX}/session/${id}/exited`,
    /** ctx/session/<id>/label — AI-generated session label */
    label: (id: string) => `${PREFIX}/session/${id}/label`,
    /** ctx/session/spawn — publish to create a new session */
    spawn: `${PREFIX}/session/spawn`,
    /** ctx/session/<id>/input — publish to write stdin to a session */
    input: (id: string) => `${PREFIX}/session/${id}/input`,
    /** ctx/session/<id>/kill — publish to terminate a session */
    kill: (id: string) => `${PREFIX}/session/${id}/kill`,
  },
  mcp: {
    /** ctx/mcp/reload — publish to trigger MCP tool hot-reload */
    reload: `${PREFIX}/mcp/reload`,
    /** ctx/mcp/status — reload result (retained) */
    status: `${PREFIX}/mcp/status`,
  },
  autoCommit: {
    /** ctx/auto-commit/status -- auto-commit service state (retained) */
    status: `${PREFIX}/auto-commit/status`,
  },
  preview: {
    /** ctx/preview/opened -- file preview opened by agent */
    opened: `${PREFIX}/preview/opened`,
  },
  proposals: {
    /** ctx/proposals/<slug>/eval — streaming evaluation tokens */
    eval: (slug: string) => `${PREFIX}/proposals/${slug}/eval`,
    /** ctx/proposals/<slug>/eval/done — final evaluation result */
    evalDone: (slug: string) => `${PREFIX}/proposals/${slug}/eval/done`,
  },
  localAi: {
    /** ctx/local-ai/status — local AI service health (retained) */
    status: `${PREFIX}/local-ai/status`,
    /** ctx/local-ai/prompt — send { prompt, replyTo?, maxTokens?, temperature? } */
    prompt: `${PREFIX}/local-ai/prompt`,
    /** ctx/local-ai/reply — default reply topic: { ok, response? , error? } */
    reply: `${PREFIX}/local-ai/reply`,
  },
};

export function topicFor(domain: string): string {
  return `${PREFIX}/${domain}`;
}

export function statusTopic(): string {
  return TOPICS.status;
}
