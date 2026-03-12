export const SOLUTION_SYSTEM = `You are an expert solution architect for the Context workspace framework.
You generate production-ready code: Fastify services, React MUI views, workspace rules, and skills.
Output only valid JSON or code blocks as requested. No emojis. No redundant comments.`;

export function solutionArchitectPrompt(
  problem: string,
  existingSolutions: string,
): string {
  return `Analyze this problem and decide what components are needed.

Problem: ${problem}

Existing solutions in this workspace (avoid overlap):
${existingSolutions || "None yet."}

Component types:
- service: Backend API (Fastify). Use for data processing, external APIs, scheduled jobs.
- view: React MUI dashboard component. Use when the user needs a visual interface.
- rule: Workspace rule (.mdc). Use for behavioral guidance, conventions, constraints.
- skill: SKILL.md workflow. Use for repeatable procedures the agent should follow.
- memory: Memory entry. Use for one-off knowledge capture, not workflows.

Guidance:
- Simple problems (tracking decisions, checklists, conventions) need only rule + skill.
- Complex problems (reports, dashboards, integrations) need service + view.
- Add memory only when the solution produces knowledge to persist.

Respond with ONLY this JSON (no markdown fences):
{
  "components": ["<type>", ...],
  "plan": "Brief description of what each component does",
  "name_suggestion": "kebab-case-name"
}`;
}

export function solutionServicePrompt(
  name: string,
  problem: string,
  plan: string,
): string {
  return `Generate a Fastify service for: ${name}

Problem: ${problem}
Plan: ${plan}

Requirements:
- Use Fastify. Expose GET /health returning { ok: true }.
- Handle SIGTERM for graceful shutdown.
- Use env vars: PORT (default 3000), MQTT_URL (optional).
- No emojis. Minimal comments.

Respond with ONLY this JSON (no markdown fences):
{
  "index_ts": "<full server/index.ts content as escaped string>",
  "routes_ts": "<full server/routes.ts content as escaped string>",
  "package_json": "<minimal package.json with fastify, dotenv>"
}`;
}

export function solutionViewPrompt(
  name: string,
  problem: string,
  plan: string,
  servicePort?: number,
): string {
  const apiHint = servicePort
    ? `Fetch data from http://localhost:${servicePort}/api/... as needed.`
    : "Use existing Command Center API: /api/sessions, /api/stats, /api/settings.";

  return `Generate a React MUI component for: ${name}

Problem: ${problem}
Plan: ${plan}

Requirements:
- Export default function component.
- Use MUI: Box, Typography, Card, CardContent, Chip, Alert, Stack, Skeleton, etc.
- Handle loading, empty, and error states.
- ${apiHint}
- No emojis. No CSS files. Use sx prop for styling.

Respond with a single tsx code block. The component must be complete and runnable.`;
}

export function solutionRulePrompt(
  name: string,
  problem: string,
  plan: string,
): string {
  return `Generate a workspace rule for: ${name}

Problem: ${problem}
Plan: ${plan}

Requirements:
- Output valid markdown with optional YAML frontmatter.
- Rule guides agent behavior for this domain.
- Concise. No emojis.`;
}

export function solutionSkillPrompt(
  name: string,
  problem: string,
  plan: string,
): string {
  return `Generate a SKILL.md for: ${name}

Problem: ${problem}
Plan: ${plan}

Requirements:
- YAML frontmatter: name, description, triggers, related_skills.
- When to Use, Workflow (numbered steps), Validation sections.
- Concise. No emojis.`;
}
