export const VIEW_SYSTEM = `You are an expert React/TypeScript developer building dashboard views.
You generate complete, working React components using MUI (Material UI v6) and TypeScript.

Rules:
- Export a default function component.
- Use MUI components: Box, Typography, Card, CardContent, Grid, Chip, Alert,
  Stack, Button, TextField, IconButton, Tooltip, Skeleton, LinearProgress,
  CircularProgress, Divider, List, ListItemButton, ListItemText, Drawer.
- Import MUI icons from "@mui/icons-material/<IconName>".
- Use useState, useEffect, useCallback from "react".
- Fetch data from the local API using fetch("/api/...").
- Handle loading, empty, and error states gracefully.
- Keep components clean and readable; inline styles via MUI sx prop.
- No external dependencies beyond react, @mui/material, @mui/icons-material.
- Do NOT use class components.
- Do NOT use any CSS files or styled-components.`;

export const ANALYSIS_SYSTEM = `You are an expert AI engineering analyst reviewing agent coding session transcripts.
Be honest and critical. Score all numeric stats 1-10 where 1 is terrible and 10 is exceptional.`;

export function analysisPrompt(transcriptPath: string): string {
  return `Read the file at ${transcriptPath} -- it is a full AI agent chat transcript.

Produce a deep retrospective analysis as a JSON object. Evaluate BOTH the human user
and the AI agent.

Required JSON schema (respond with ONLY this JSON, no markdown fences):
{
  "verdict": "<one of: productive, mixed, struggling, blocked>",
  "title": "<6 words max>",
  "summary": "<2-3 sentence narrative>",
  "wins": ["<concrete positive outcomes>"],
  "errors": ["<mistakes, failed attempts>"],
  "gaps": ["<missing knowledge, unused tools>"],
  "user_stats": {
    "clarity": <1-10>, "frustration": <1-10>, "engagement": <1-10>,
    "ambition": <1-10>, "adaptability": <1-10>
  },
  "agent_stats": {
    "competence": <1-10>, "efficiency": <1-10>, "creativity": <1-10>,
    "autonomy": <1-10>, "thoroughness": <1-10>
  },
  "efficiency": {
    "wasted_cycles": "<description>",
    "bottlenecks": "<what slowed things down>",
    "score": <1-10>
  },
  "insights": ["<non-obvious observations>"],
  "recommendations": ["<actionable suggestions>"]
}`;
}

export function skillEvolutionPrompt(skillMd: string, analyses: string): string {
  return `You are evolving an AI agent skill based on real session data.

Current skill:
${skillMd}

Recent session analyses using this skill:
${analyses}

Produce a JSON response with the improved skill:
{
  "skill_md": "<full updated SKILL.md content>",
  "resources": [{"path": "<relative path>", "content": "<file content>"}]
}

Improve the skill based on patterns in the analyses. Add workflow steps,
validation checks, or references that address the gaps and errors found.
Do not remove existing content unless it conflicts with observed patterns.`;
}

export function memorySynthesisPrompt(analyses: string, existing: string): string {
  return `You are a knowledge manager synthesizing agent session analyses into
structured memory entries.

Recent analyses:
${analyses}

Existing memory filenames (avoid duplicates):
${existing}

Produce a JSON array of memory entries to create:
[{
  "category": "<decisions|known-issues|progress|observations|preferences|environment>",
  "filename": "<slug>.md",
  "content": "<frontmatter + markdown body>"
}]

Focus on non-obvious patterns, recurring issues, and decisions that future
sessions should know about. Skip trivial or already-captured observations.`;
}

export function viewGeneratePrompt(
  name: string,
  description: string,
  seedExample: string,
): string {
  return `Generate a React view component called "${name}".

Description: ${description}

Available API endpoints the view can call:
- GET /api/sessions?page=0&pageSize=25 -> { records, page, totalPages, total }
- GET /api/sessions/:chatId -> { record, analysis }
- GET /api/stats -> { totalSessions, analyzedSessions, productiveRate, avgEfficiency, ... }
- GET /api/settings -> { ai_provider, profiler_mode, ... }
- PUT /api/settings -> { ok: true }

Here is an existing view as a reference for patterns and style:

\`\`\`tsx
${seedExample}
\`\`\`

Generate only the component code. Wrap the output in a single tsx code fence.
The component must export default. Include loading/empty/error states.`;
}

export function scaffoldPrompt(
  projectName: string,
  projectType: string,
  description: string,
  goals: string[],
  repos: Array<{ name: string; url?: string }>,
): string {
  return `You are generating initial workspace content for a new project intelligence layer.

Project: ${projectName}
Type: ${projectType}
Description: ${description}
Goals: ${goals.join(", ")}
Repositories: ${repos.map((r) => r.name + (r.url ? ` (${r.url})` : "")).join(", ") || "none yet"}

Generate a JSON object with initial rules, skills, and memory entries appropriate
for this project type and goals. Software projects need code-oriented rules;
non-software projects need knowledge/operations-oriented rules.

Required JSON schema (respond with ONLY this JSON, no markdown fences):
{
  "rules": [
    {"name": "<filename without .md>", "content": "<full markdown content with YAML frontmatter>"}
  ],
  "skills": [
    {"name": "<skill-name>", "content": "<full SKILL.md content with YAML frontmatter>"}
  ],
  "memory": [
    {"category": "<decisions|preferences|observations>", "filename": "<slug>.md", "content": "<markdown>"}
  ]
}

Guidelines:
- Generate 2-4 rules covering the project's core patterns
- Generate 1-2 starter skills for the most common workflows
- Generate 1-2 initial memory entries (project setup decisions, team preferences)
- For software projects: include code review, commit format, testing patterns
- For operations projects: include decision tracking, knowledge linking, review workflows
- For research projects: include documentation standards, experiment tracking
- All content should use poly-repo, security-first, MQTT-backed patterns where applicable
- Keep each rule/skill concise (under 50 lines)`;
}

export const UI_PREFERENCES_SYSTEM = `You translate natural-language UI preferences into a JSON branding config.
Return ONLY a valid JSON object matching this exact shape (no markdown fences):
{
  "name": "Context",
  "subtitle": "Command Center",
  "accentGradient": "linear-gradient(135deg, <color1>, <color2>)",
  "borderRadius": <number 4-20>,
  "dark": {
    "primary": "<hex>", "secondary": "<hex>", "success": "<hex>",
    "warning": "<hex>", "error": "<hex>", "background": "<hex>",
    "surface": "<hex>", "text": "<hex>", "textSecondary": "<hex>"
  },
  "light": {
    "primary": "<hex>", "secondary": "<hex>", "success": "<hex>",
    "warning": "<hex>", "error": "<hex>", "background": "<hex>",
    "surface": "<hex>", "text": "<hex>", "textSecondary": "<hex>"
  }
}

Guidelines:
- Ensure sufficient contrast between text and background (WCAG AA minimum).
- Dark mode backgrounds should be 10-20 luminance; light mode 90-98.
- Keep success green-ish, warning amber-ish, error red-ish unless user overrides.
- borderRadius: "sharp" = 4, "rounded" = 12, "very rounded/pill" = 20.
- Gradient should use the primary and secondary colors.`;

export function uiPreferencesPrompt(description: string): string {
  return `The user wants their workspace UI to look like this:

"${description}"

Generate the branding config JSON. Match their described mood, colors, and style.`;
}

export function viewModifyPrompt(
  name: string,
  currentSource: string,
  instruction: string,
): string {
  return `Modify the React view component "${name}" according to this instruction:

${instruction}

Current source:

\`\`\`tsx
${currentSource}
\`\`\`

Return the complete modified component. Wrap the output in a single tsx code fence.
Preserve the default export. Do not remove existing functionality unless the
instruction explicitly asks for it.`;
}
