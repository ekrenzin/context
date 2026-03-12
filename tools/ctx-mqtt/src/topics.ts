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
  },
};

export function topicFor(domain: string): string {
  return `${PREFIX}/${domain}`;
}

export function statusTopic(): string {
  return TOPICS.status;
}
