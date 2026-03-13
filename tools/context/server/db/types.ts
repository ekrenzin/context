export interface SessionRow {
  chat_id: string;
  title: string;
  summary: string;
  verdict: string;
  first_query: string;
  date: string;
  timestamp: string;
  file_bytes: number;
  user_turns: number;
  assistant_turns: number;
  total_calls: number;
  tools: string;
  skills: string;
  skill_counts: string;
  subagent_types: string;
  plan_mode: number;
  thinking_blocks: number;
  response_chars_total: number;
  response_chars_avg: number;
  response_chars_max: number;
  analysis: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsRow {
  date: string;
  total_sessions: number;
  analyzed_sessions: number;
  productive_rate: number;
  avg_efficiency: number;
  current_streak: number;
  best_streak: number;
  total_tool_calls: number;
  unique_skills: number;
  avg_turns: number;
  activity_map: string;
  trends: string;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string;
  repo: string | null;
  ticket: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptRow {
  chat_id: string;
  content: string;
  imported_at: string;
}

export interface LearningRow {
  id: string;
  type: string;
  source: string | null;
  content: string;
  metadata: string;
  created_at: string;
  applied_at: string | null;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface ProjectRow {
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

export interface ApprovalRow {
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

export interface FeedEventRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
}

export interface McpServerRow {
  id: string;
  name: string;
  namespace: string;
  version: string;
  command: string;
  args: string;
  env: string;
  enabled: number;
  targets: string;
  config_schema: string;
  repo_url: string | null;
  stars: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigField {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  description?: string;
}
