export interface SolutionExample {
  problem: string;
  name: string;
  persona: "non-technical" | "power-user";
  intent: string;
  icon: string;
}

export const SOLUTION_EXAMPLES: SolutionExample[] = [
  // build
  {
    problem: "Monitor deployment health across environments",
    name: "deploy-monitor",
    persona: "power-user",
    intent: "build",
    icon: "Cloud",
  },
  {
    problem: "Track and prioritize dependency updates",
    name: "dep-tracker",
    persona: "power-user",
    intent: "build",
    icon: "Update",
  },
  {
    problem: "Security audit checklist for code reviews",
    name: "security-audit",
    persona: "power-user",
    intent: "build",
    icon: "Security",
  },
  {
    problem: "Generate a changelog from recent commits",
    name: "changelog-gen",
    persona: "power-user",
    intent: "build",
    icon: "History",
  },

  // design
  {
    problem: "Organize design assets and track revisions",
    name: "asset-tracker",
    persona: "non-technical",
    intent: "design",
    icon: "Palette",
  },
  {
    problem: "Collect and tag feedback on creative work",
    name: "feedback-collector",
    persona: "non-technical",
    intent: "design",
    icon: "RateReview",
  },
  {
    problem: "Generate content briefs from project goals",
    name: "content-brief",
    persona: "non-technical",
    intent: "design",
    icon: "Description",
  },
  {
    problem: "Build a mood board from reference links and notes",
    name: "mood-board",
    persona: "non-technical",
    intent: "design",
    icon: "ViewQuilt",
  },

  // plan
  {
    problem: "Track project decisions and the reasoning behind them",
    name: "decision-tracker",
    persona: "non-technical",
    intent: "plan",
    icon: "CheckCircle",
  },
  {
    problem: "Generate a weekly summary of team progress",
    name: "weekly-report",
    persona: "non-technical",
    intent: "plan",
    icon: "Summarize",
  },
  {
    problem: "Organize and search meeting notes",
    name: "meeting-notes",
    persona: "non-technical",
    intent: "plan",
    icon: "Notes",
  },
  {
    problem: "Remind me of upcoming deadlines and milestones",
    name: "deadline-reminder",
    persona: "non-technical",
    intent: "plan",
    icon: "Event",
  },

  // research
  {
    problem: "Summarize long documents and extract key findings",
    name: "doc-summarizer",
    persona: "power-user",
    intent: "research",
    icon: "AutoStories",
  },
  {
    problem: "Compare data across sources and flag discrepancies",
    name: "data-compare",
    persona: "power-user",
    intent: "research",
    icon: "CompareArrows",
  },
  {
    problem: "Track citations and build a reference library",
    name: "citation-tracker",
    persona: "power-user",
    intent: "research",
    icon: "MenuBook",
  },
  {
    problem: "Generate charts and visualizations from raw data",
    name: "data-viz",
    persona: "power-user",
    intent: "research",
    icon: "BarChart",
  },

  // learn
  {
    problem: "Walk me through this codebase step by step",
    name: "codebase-tour",
    persona: "non-technical",
    intent: "learn",
    icon: "School",
  },
  {
    problem: "Explain concepts as I encounter them",
    name: "concept-explainer",
    persona: "non-technical",
    intent: "learn",
    icon: "Lightbulb",
  },
  {
    problem: "Build a small project to learn by doing",
    name: "learning-project",
    persona: "non-technical",
    intent: "learn",
    icon: "Build",
  },
  {
    problem: "Create a study plan for a new skill",
    name: "study-plan",
    persona: "non-technical",
    intent: "learn",
    icon: "Route",
  },
];
