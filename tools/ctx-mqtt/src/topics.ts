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
    /** ctx/session/<id>/state — AI-reported session state (running|waiting|idle) */
    state: (id: string) => `${PREFIX}/session/${id}/state`,
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
    /** ctx/proposals/created — published when a new proposal is created */
    created: `${PREFIX}/proposals/created`,
    /** ctx/proposals/changed — published when any proposal is created, updated, or deleted */
    changed: `${PREFIX}/proposals/changed`,
    /** ctx/proposals/<slug>/eval — streaming evaluation tokens */
    eval: (slug: string) => `${PREFIX}/proposals/${slug}/eval`,
    /** ctx/proposals/<slug>/eval/done — final evaluation result */
    evalDone: (slug: string) => `${PREFIX}/proposals/${slug}/eval/done`,
  },
  action: {
    /** ctx/terminal/action/request -- publish to request a terminal action */
    request: `${PREFIX}/terminal/action/request`,
    /** ctx/terminal/action -- published when an action is created */
    created: `${PREFIX}/terminal/action`,
    /** ctx/terminal/action/<id>/completed -- published when user marks action done */
    completed: (id: string) => `${PREFIX}/terminal/action/${id}/completed`,
  },
  localAi: {
    /** ctx/local-ai/status — local AI service health (retained) */
    status: `${PREFIX}/local-ai/status`,
    /** ctx/local-ai/prompt — send { prompt, replyTo?, maxTokens?, temperature?, tools?, route? } */
    prompt: `${PREFIX}/local-ai/prompt`,
    /** ctx/local-ai/reply — default reply topic: { ok, response?, error?, backend? } */
    reply: `${PREFIX}/local-ai/reply`,
    /** ctx/local-ai/routed — routing decision event: { backend, reason, model, tokens } */
    routed: `${PREFIX}/local-ai/routed`,
    /** ctx/local-ai/tool-call — tool execution event: { name, args, duration } */
    toolCall: `${PREFIX}/local-ai/tool-call`,
    /** ctx/local-ai/models — retained topic with available models list */
    models: `${PREFIX}/local-ai/models`,
  },
  security: {
    /** ctx/security/scan/started -- scan lifecycle started */
    scanStarted: `${PREFIX}/security/scan/started`,
    /** ctx/security/vulnerability/found -- individual CVE finding */
    vulnerabilityFound: `${PREFIX}/security/vulnerability/found`,
    /** ctx/security/scan/complete -- scan finished with summary */
    scanComplete: `${PREFIX}/security/scan/complete`,
    /** ctx/security/patch/applied -- dependency upgraded */
    patchApplied: `${PREFIX}/security/patch/applied`,
  },
  agent: {
    /** ctx/agent/<tool>/session/started — agent session began */
    sessionStarted: (tool: string) => `${PREFIX}/agent/${tool}/session/started`,
    /** ctx/agent/<tool>/session/ended — agent session finished */
    sessionEnded: (tool: string) => `${PREFIX}/agent/${tool}/session/ended`,
    /** ctx/agent/<tool>/tool/used — agent invoked a tool (read, edit, bash, etc.) */
    toolUsed: (tool: string) => `${PREFIX}/agent/${tool}/tool/used`,
    /** ctx/agent/<tool>/file/read — agent read a file */
    fileRead: (tool: string) => `${PREFIX}/agent/${tool}/file/read`,
    /** ctx/agent/<tool>/file/written — agent wrote a file */
    fileWritten: (tool: string) => `${PREFIX}/agent/${tool}/file/written`,
    /** ctx/agent/<tool>/file/edited — agent edited a file */
    fileEdited: (tool: string) => `${PREFIX}/agent/${tool}/file/edited`,
    /** ctx/agent/<tool>/test/ran — agent ran tests */
    testRan: (tool: string) => `${PREFIX}/agent/${tool}/test/ran`,
    /** ctx/agent/<tool>/commit/created — agent created a commit */
    commitCreated: (tool: string) => `${PREFIX}/agent/${tool}/commit/created`,
    /** ctx/agent/<tool>/error — agent encountered an error */
    error: (tool: string) => `${PREFIX}/agent/${tool}/error`,
    /** ctx/agent/<tool>/cost — token usage and cost estimate */
    cost: (tool: string) => `${PREFIX}/agent/${tool}/cost`,
    /** Generic: ctx/agent/<tool>/<event> — any custom event */
    custom: (tool: string, event: string) => `${PREFIX}/agent/${tool}/${event}`,
  },
};

export function topicFor(domain: string): string {
  return `${PREFIX}/${domain}`;
}

export function statusTopic(): string {
  return TOPICS.status;
}
