export interface SolutionExample {
  problem: string;
  name: string;
  persona: "non-technical" | "power-user";
  icon: string;
}

export const SOLUTION_EXAMPLES: SolutionExample[] = [
  {
    problem: "Track project decisions and the reasoning behind them",
    name: "decision-tracker",
    persona: "non-technical",
    icon: "CheckCircle",
  },
  {
    problem: "Generate a weekly summary of team progress",
    name: "weekly-report",
    persona: "non-technical",
    icon: "Summarize",
  },
  {
    problem: "Organize and search meeting notes",
    name: "meeting-notes",
    persona: "non-technical",
    icon: "Notes",
  },
  {
    problem: "Remind me of upcoming deadlines and milestones",
    name: "deadline-reminder",
    persona: "non-technical",
    icon: "Event",
  },
  {
    problem: "Monitor deployment health across environments",
    name: "deploy-monitor",
    persona: "power-user",
    icon: "Cloud",
  },
  {
    problem: "Track and prioritize dependency updates",
    name: "dep-tracker",
    persona: "power-user",
    icon: "Update",
  },
  {
    problem: "Security audit checklist for code reviews",
    name: "security-audit",
    persona: "power-user",
    icon: "Security",
  },
  {
    problem: "Generate a changelog from recent commits",
    name: "changelog-gen",
    persona: "power-user",
    icon: "History",
  },
];
