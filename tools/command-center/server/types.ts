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
  efficiency: {
    wastedCycles: string;
    bottlenecks: string;
    score: number;
  };
  insights: string[];
  recommendations: string[];
}

export interface ProfileSkill {
  name: string;
  count: number;
  lastSeen: string;
}

export interface ProfileData {
  skills: ProfileSkill[];
  tools: Array<{ name: string; count: number }>;
  lastScan: string;
  sessions: number;
}

export interface TrendDirection {
  direction: "up" | "down" | "neutral";
  delta: number;
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
    productiveRate: TrendDirection;
    efficiency: TrendDirection;
    toolCalls: TrendDirection;
  };
}

export interface RepoEntry {
  name: string;
  branch: string;
  description: string;
  installCommand?: string;
  present: boolean;
}

export interface TunnelInstance {
  pid: number;
  port: number;
  url: string;
  fullUrl: string;
  startedAt: string;
  alive?: boolean;
}

export interface TunnelState {
  tunnels: Record<string, TunnelInstance>;
}

export interface TestConfig {
  name: string;
  command: string;
  watchCommand?: string;
  cwd: string;
}

export interface QuickAction {
  label: string;
  command: string;
  cwd?: string;
  icon?: string;
}

export interface LogPrefix {
  label: string;
  value: string;
}

export interface DashboardConfig {
  tests: TestConfig[];
  actions: QuickAction[];
  logPrefixes: LogPrefix[];
  logWindows: string[];
  logSyncLabel?: string;
}

export interface ServiceDefinition {
  label: string;
  command: string;
  cwd: string;
  isBackground: boolean;
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

export type AgentJobType =
  | "profile-scan"
  | "session-analysis"
  | "codebase-scan"
  | "memory-synthesis"
  | "skill-evolution"
  | "agent-synthesis"
  | "knowledge-index"
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

export interface IntelMetaPhase {
  phase: number;
  file: string;
  status: "complete" | "error";
}

export interface IntelRunMeta {
  repo: string;
  focus?: string;
  depth: string;
  startedAt: string;
  completedAt?: string;
  phases?: IntelMetaPhase[];
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

export type IntelListResponse = {
  runs: IntelRun[];
  legacyReports: IntelReport[];
};

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

export interface SkillsSyncStatus {
  state: "current" | "error" | "unknown";
  totalSkills: number;
  linked: number;
  skipped: string[];
  lastSyncedAt: string;
  cacheDir: string;
  targetDir: string;
  updated?: boolean;
  error?: string;
}

export interface LogEntry {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  name: string;
  msg: string;
  [key: string]: unknown;
}

