const BASE = "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export interface SessionRecord {
  chatId: string;
  title: string;
  summary: string;
  verdict: string;
  firstQuery: string;
  date: string;
  timestamp: string;
  fileBytes: number;
  userTurns: number;
  assistantTurns: number;
  totalCalls: number;
  tools: Record<string, number>;
  skills: string[];
  skillCounts: Record<string, number>;
  subagentTypes: Record<string, number>;
  planMode: boolean;
  thinkingBlocks: number;
  responseCharsTotal: number;
  responseCharsAvg: number;
  responseCharsMax: number;
}

export interface SessionsPage {
  records: SessionRecord[];
  page: number;
  totalPages: number;
  total: number;
}

export interface StatsOverview {
  totalSessions: number;
  analyzedSessions: number;
  productiveRate: number;
  avgEfficiency: number;
  currentStreak: number;
  bestStreak: number;
  totalToolCalls: number;
  uniqueSkills: number;
  avgTurns: number;
  activityMap: Record<string, number>;
  trends: {
    productiveRate: { direction: string; delta: number };
    efficiency: { direction: string; delta: number };
    toolCalls: { direction: string; delta: number };
  };
}

export interface IdentityProvider {
  provider: "github" | "cursor" | "aws";
  status: "connected" | "disconnected" | "unknown";
  username?: string;
  displayName?: string;
  email?: string;
}

export interface IdentitySnapshot {
  github: IdentityProvider;
  cursor: IdentityProvider;
  aws: IdentityProvider;
  updatedAt: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface UpdateStatus {
  branch: string;
  sha: string;
  commitMessage?: string;
  history?: CommitInfo[];
  ahead: number;
  behind: number;
  dirty: boolean;
  state: "current" | "behind" | "ahead" | "diverged" | "error" | "unknown";
  lastCheckedAt: string;
  autoUpdated: boolean;
  previousSha?: string;
  error?: string;
}

export interface ViewGenerateRequest {
  name: string;
  description: string;
}

export interface ViewEntry {
  name: string;
  path: string;
  label: string;
  icon: string;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  root_path: string;
  status: string;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRecord {
  id: string;
  project_id: string;
  type: string;
  title: string;
  summary: string;
  diff: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface FeedEvent {
  id: string;
  project_id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
}

export interface IntelItem {
  name: string;
  description: string;
  content: string;
}

export interface LaunchResult {
  method: "opened" | "session";
  label: string;
  sessionId?: string;
}

export interface IdeInfo {
  name: string;
}

export interface ProjectFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface ProjectBrowseResult {
  current: string;
  root: string;
  relative: string;
  parent: string | null;
  entries: ProjectFileEntry[];
  exists: boolean;
}

export interface FileReadResult {
  path: string;
  name: string;
  size: number;
  binary: boolean;
  truncated?: boolean;
  content: string | null;
}

export const api = {
  sessions: (page = 0, pageSize = 25) =>
    get<SessionsPage>(`/api/sessions?page=${page}&pageSize=${pageSize}`),

  stats: () => get<StatsOverview>("/api/stats"),

  identities: () => get<IdentitySnapshot>("/api/identities"),

  updates: () => get<UpdateStatus>("/api/updates"),

  viewsList: () => get<ViewEntry[]>("/api/views"),

  generateView: (req: ViewGenerateRequest) =>
    postJson<ViewEntry>("/api/views/generate", req),

  modifyView: (name: string, instruction: string) =>
    postJson<{ ok: boolean }>("/api/views/modify", { name, instruction }),

  viewSource: (name: string) =>
    get<{ source: string }>(`/api/views/${encodeURIComponent(name)}/source`),

  // Projects
  listProjects: () => get<ProjectRecord[]>("/api/projects"),

  getProject: (id: string) => get<ProjectRecord>(`/api/projects/${id}`),

  createProject: (body: {
    name: string;
    description?: string;
    rootPath: string;
    projectType?: string;
    goals?: string[];
    repos?: Array<{ name: string; url?: string; path?: string }>;
    config?: Record<string, unknown>;
  }) => postJson<ProjectRecord>("/api/projects", body),

  importProject: (rootPath: string, name?: string) =>
    postJson<ProjectRecord>("/api/projects/import", { rootPath, name }),

  updateProject: (id: string, body: Record<string, unknown>) =>
    patchJson<ProjectRecord>(`/api/projects/${id}`, body),

  deleteProject: (id: string) => del<{ ok: boolean }>(`/api/projects/${id}`),

  // Approvals
  listApprovals: (projectId: string, status = "pending") =>
    get<ApprovalRecord[]>(`/api/projects/${projectId}/approvals?status=${status}`),

  approveApproval: (projectId: string, approvalId: string) =>
    postJson<{ ok: boolean }>(`/api/projects/${projectId}/approvals/${approvalId}/approve`, {}),

  rejectApproval: (projectId: string, approvalId: string) =>
    postJson<{ ok: boolean }>(`/api/projects/${projectId}/approvals/${approvalId}/reject`, {}),

  // Feed
  listFeed: (projectId: string, opts?: { type?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.type) params.set("type", opts.type);
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return get<FeedEvent[]>(`/api/projects/${projectId}/feed${qs ? `?${qs}` : ""}`);
  },

  // Intelligence
  listRules: (projectId: string) => get<IntelItem[]>(`/api/projects/${projectId}/rules`),
  listSkills: (projectId: string) => get<IntelItem[]>(`/api/projects/${projectId}/skills`),
  listMemory: (projectId: string, category?: string) => {
    const qs = category ? `?category=${category}` : "";
    return get<IntelItem[]>(`/api/projects/${projectId}/memory${qs}`);
  },

  // IDE
  listIdes: () => get<IdeInfo[]>("/api/ides"),
  launchIde: (projectId: string, ide: string) =>
    postJson<LaunchResult>(`/api/projects/${projectId}/launch`, { ide }),

  // Terminal
  spawnTerminal: (command?: string, args?: string[], cwd?: string) =>
    postJson<{ id: string; command: string; cwd: string; startedAt: string; label?: string }>(
      "/api/terminal",
      { command, args, cwd },
    ),

  listTerminals: () =>
    get<Array<{ id: string; command: string; cwd: string; startedAt: string; exitCode?: number; label?: string }>>(
      "/api/terminal",
    ),

  getTerminal: (id: string) =>
    get<{ id: string; command: string; cwd: string; startedAt: string; exitCode?: number; label?: string }>(
      `/api/terminal/${id}`,
    ),

  renameTerminal: (id: string, label: string) =>
    patchJson<{ ok: boolean; label: string }>(`/api/terminal/${id}/label`, { label }),

  killTerminal: (id: string) => del<{ killed: boolean }>(`/api/terminal/${id}`),

  // Ollama
  ollamaStatus: () =>
    get<{ installed: boolean; running: boolean; version: string | null; models: Array<{ name: string; size: number }> }>(
      "/api/ollama/status",
    ),

  ollamaInstall: () => postJson<{ success: boolean; error?: string }>("/api/ollama/install", {}),

  ollamaPull: (model: string) => postJson<{ ok: boolean }>("/api/ollama/pull", { model }),

  ollamaTest: (model: string) =>
    postJson<{ ok: boolean; result?: string; latency?: number; error?: string }>(
      "/api/ollama/test",
      { model },
    ),

  // Session logs
  listSessionLogs: () =>
    get<SessionLogMeta[]>("/api/session-logs"),

  getSessionLog: (id: string) =>
    get<{ entries: SessionLogEntry[] }>(`/api/session-logs/${id}`),

  deleteSessionLog: (id: string) => del<{ deleted: boolean }>(`/api/session-logs/${id}`),

  // Project filesystem
  projectBrowse: (root: string, browsePath?: string) => {
    const params = new URLSearchParams({ root });
    if (browsePath) params.set("path", browsePath);
    return get<ProjectBrowseResult>(`/api/fs/project-browse?${params}`);
  },

  readFile: (filePath: string, root?: string) => {
    const params = new URLSearchParams({ path: filePath });
    if (root) params.set("root", root);
    return get<FileReadResult>(`/api/fs/read?${params}`);
  },
};

export interface SessionLogMeta {
  id: string;
  command?: string;
  cwd?: string;
  startedAt?: string;
  exitCode?: number;
  lineCount: number;
  sizeBytes: number;
}

export interface SessionLogEntry {
  ts: string;
  type: "started" | "output" | "exited";
  data?: string;
  command?: string;
  cwd?: string;
  exitCode?: number;
}
