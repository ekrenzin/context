const BASE = "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
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

export interface SessionAnalysis {
  verdict: string;
  title: string;
  summary: string;
  wins: string[];
  errors: string[];
  gaps: string[];
  userStats: Record<string, number>;
  agentStats: Record<string, number>;
  efficiency: { wastedCycles: string; bottlenecks: string; score: number };
  insights: string[];
  recommendations: string[];
}

export interface ProfileData {
  skills: Array<{ name: string; count: number; lastSeen: string }>;
  tools: Array<{ name: string; count: number }>;
  lastScan: string;
  sessions: number;
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

export interface TunnelInstance {
  pid: number;
  port: number;
  url: string;
  fullUrl: string;
  startedAt: string;
  alive?: boolean;
}

export interface RepoEntry {
  name: string;
  branch: string;
  description: string;
  installCommand?: string;
  present: boolean;
}

export interface DashboardConfig {
  tests: Array<{ name: string; command: string; watchCommand?: string; cwd: string }>;
  actions: Array<{ label: string; command: string; cwd?: string; icon?: string }>;
  logPrefixes: Array<{ label: string; value: string }>;
  logWindows: string[];
  logSyncLabel?: string;
}

export interface SkillNode {
  id: string;
  description: string;
  category: string;
  relatedSkills: string[];
}

export interface SkillEdge {
  source: string;
  target: string;
  type: "trigger" | "related";
}

export interface SkillGraph {
  nodes: SkillNode[];
  edges: SkillEdge[];
}

export interface IdentityProvider {
  provider: "github" | "cursor" | "aws";
  status: "connected" | "disconnected" | "unknown";
  username?: string;
  displayName?: string;
  email?: string;
  team?: string;
  accountId?: string;
  detail?: string;
}

export interface IdentitySnapshot {
  github: IdentityProvider;
  cursor: IdentityProvider;
  aws: IdentityProvider;
  updatedAt: string;
}

export interface SessionMapNode {
  id: string;
  title: string;
  date: string;
  verdict: string;
  skills: string[];
  theme: string;
  totalCalls: number;
  userTurns: number;
  repos: string[];
}

export interface SessionMapEdge {
  source: string;
  target: string;
  weight: number;
  sharedSkills: string[];
}

export interface SessionMapData {
  nodes: SessionMapNode[];
  edges: SessionMapEdge[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type IntelReportType =
  | "product-analysis"
  | "competitor-search"
  | "competitor-deepdive"
  | "industry-leaders"
  | "news-scan"
  | "article-analysis"
  | "competitive-suggestions"
  | "demo-sales"
  | "market-analysis";

export interface IntelReport {
  filename: string;
  type: IntelReportType;
  title: string;
  date: string;
  sizeBytes: number;
}

export interface IntelRunPhase {
  filename: string;
  type: IntelReportType;
  title: string;
  sizeBytes: number;
  order: number;
}

export interface IntelRunProgress {
  completedPhases: number;
  expectedPhases: number;
  currentLabel?: string;
  elapsedSec: number;
}

export interface IntelRun {
  id: string;
  dirName: string;
  repo: string;
  date: string;
  depth: string;
  focus?: string;
  complete: boolean;
  phases: IntelRunPhase[];
  totalBytes: number;
  progress?: IntelRunProgress;
}

export interface IntelListResponse {
  runs: IntelRun[];
  legacyReports: IntelReport[];
}

export type AgentJobType =
  | "profile-scan"
  | "session-analysis"
  | "codebase-scan"
  | "memory-synthesis"
  | "skill-evolution"
  | "agent-synthesis"
  | "intel-analysis";

export type AgentJobStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";

export type AgentJobTrigger = "periodic" | "manual";

export interface AgentJob {
  id: string;
  type: AgentJobType;
  status: AgentJobStatus;
  trigger: AgentJobTrigger;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  detail?: string;
  logTail: string[];
  exitCode?: number;
}

export interface FingerprintSources {
  transcripts: string;
  repos: string;
  memory: string;
}

export interface AgentSchedulerState {
  jobs: AgentJob[];
  lastCheckedAt: string;
  lastFingerprint: string;
  fingerprintSources: FingerprintSources;
  nextRunAt: string;
  running: boolean;
  intervalMs: number;
}

export interface MemoryCandidate {
  category: string;
  filename: string;
  content: string;
}

export interface SkillResource {
  path: string;
  content: string;
}

export interface SkillCandidate {
  skillName: string;
  skillDir: string;
  currentMd: string;
  skillMd: string;
  resources: SkillResource[];
  analysisCount: number;
}

export interface AgentCandidate {
  agentName: string;
  skills: string[];
  frequency: number;
  confidence: number;
  triggerPhrases: string[];
  skillMd: string;
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
  stashConflict?: boolean;
}

export interface DepStatus {
  name: string;
  installed: boolean;
  group: string;
}

export interface EnvStatus {
  pythonVersion: string | null;
  cliInstalled: boolean;
  venvExists: boolean;
  deps: DepStatus[];
}

export interface BootstrapResult {
  success: boolean;
  exitCode: number;
  output: string;
  env: EnvStatus;
}

export interface MigrateEnvironment {
  label: string;
  script: string;
  command: string;
}

export interface MigrateResult {
  success: boolean;
  exitCode: number | string | undefined;
  output: string;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
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

export const api = {
  sessions: (page = 0, pageSize = 25) =>
    get<SessionsPage>(`/api/sessions?page=${page}&pageSize=${pageSize}`),

  sessionDetail: (chatId: string) =>
    get<{ record: SessionRecord | null; analysis: SessionAnalysis | null }>(
      `/api/sessions/${chatId}`,
    ),

  profile: () => get<ProfileData>("/api/profile"),

  stats: () => get<StatsOverview>("/api/stats"),

  tunnels: () => get<{ tunnels: Record<string, TunnelInstance> }>("/api/tunnels"),

  repos: () => get<RepoEntry[]>("/api/repos"),

  config: () =>
    get<{ dashboard: DashboardConfig; services: string[] }>("/api/config"),

  identities: () => get<IdentitySnapshot>("/api/identities"),

  skillGraph: () => get<SkillGraph>("/api/skills/graph"),

  sessionMap: () => get<SessionMapData>("/api/sessions/map"),

  sessionTranscript: (chatId: string) =>
    get<{ turns: ChatTurn[] }>(`/api/sessions/${chatId}/transcript`),

  agents: () => get<AgentSchedulerState>("/api/agents"),

  triggerAgents: () => post<{ queued: boolean }>("/api/agents/trigger"),

  triggerJob: (type: AgentJobType) =>
    post<{ queued: boolean }>(`/api/agents/trigger/${type}`),

  cancelPipeline: () => post<{ cancelled: boolean }>("/api/agents/cancel"),

  cancelJob: (jobId: string) =>
    post<{ cancelled: boolean }>(`/api/agents/cancel/${jobId}`),

  skillCandidates: () => get<SkillCandidate[]>("/api/agents/skill-candidates"),

  applySkillCandidate: (candidate: SkillCandidate) =>
    postJson<{ applied: boolean; skillName: string }>("/api/agents/skill-candidates/apply", candidate),

  dismissSkillCandidate: (skillName: string) =>
    postJson<{ dismissed: boolean }>("/api/agents/skill-candidates/dismiss", { skillName }),

  agentCandidates: () => get<AgentCandidate[]>("/api/agents/agent-candidates"),

  applyAgentCandidate: (candidate: AgentCandidate) =>
    postJson<{ applied: boolean; agentName: string }>("/api/agents/agent-candidates/apply", candidate),

  dismissAgentCandidate: (agentName: string) =>
    postJson<{ dismissed: boolean }>("/api/agents/agent-candidates/dismiss", { agentName }),

  intelList: () => get<IntelListResponse>("/api/intel"),

  createIntelRun: (repo: string, depth: string, focus?: string) =>
    postJson<{ runId: string }>("/api/intel/runs", { repo, depth, focus }),

  triggerIntelAnalysis: (repo: string, depth: string, runId: string, focus?: string) =>
    postJson<{ queued: boolean; jobId?: string }>(
      "/api/agents/trigger/intel-analysis",
      { repo, depth, focus, runId },
    ),

  intelRunContent: (runId: string) =>
    get<{ content: string }>(`/api/intel/runs/${encodeURIComponent(runId)}`),

  intelRunPhaseContent: (runId: string, filename: string) =>
    get<{ content: string }>(
      `/api/intel/runs/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}`,
    ),

  intelLegacyContent: (filename: string) =>
    get<{ content: string }>(
      `/api/intel/legacy/${encodeURIComponent(filename)}`,
    ),

  migrateEnvironments: () =>
    get<MigrateEnvironment[]>("/api/platform/migrate/environments"),

  migrate: (script: string, undo = false) =>
    postJson<MigrateResult>("/api/platform/migrate", { script, undo }),

  updates: () => get<UpdateStatus>("/api/updates"),

  checkForUpdates: () => post<UpdateStatus>("/api/updates/check"),

  pullUpdates: () => post<UpdateStatus>("/api/updates/pull"),

  env: () => get<EnvStatus>("/api/env"),

  bootstrap: (extras?: string) =>
    postJson<BootstrapResult>("/api/env/bootstrap", extras ? { extras } : {}),
};
