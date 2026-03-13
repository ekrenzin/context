export const PROJECT_TYPES = ["software", "operations", "research", "mixed"];

export const IDE_OPTIONS = [
  { value: "cursor", label: "Cursor" },
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "windsurf", label: "Windsurf" },
];

export const GOAL_OPTIONS = [
  "Code patterns and best practices",
  "Decision history and rationale",
  "Team preferences and conventions",
  "Security posture tracking",
  "Project knowledge base",
  "Session analysis and profiling",
];

export interface WizardState {
  name: string;
  description: string;
  rootPath: string;
  projectType: string;
  repos: Array<{ name: string; url: string }>;
  ides: string[];
  goals: string[];
}

export const INITIAL_STATE: WizardState = {
  name: "",
  description: "",
  rootPath: "",
  projectType: "software",
  repos: [],
  ides: ["cursor"],
  goals: [],
};
