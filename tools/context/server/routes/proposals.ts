import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import { TOPICS } from "ctx-mqtt/topics";

interface ProposalFrontmatter {
  title?: string;
  date?: string;
  status?: string;
  ticket?: string | null;
  repo?: string;
}

interface TaskFrontmatter {
  task?: string;
  agent?: string;
  model?: string;
  depends_on?: number[];
  status?: string;
}

export interface ProposalSummary {
  slug: string;
  title: string;
  date: string;
  status: string;
  repo: string;
  ticket: string | null;
  taskCount: number;
  tasksByStatus: Record<string, number>;
}

export interface TaskFile {
  number: number;
  filename: string;
  name: string;
  agent: string;
  model: string;
  dependsOn: number[];
  status: string;
  content: string;
}

export interface ProposalDetail extends ProposalSummary {
  proposal: string;
  impact: string | null;
  tasks: TaskFile[];
}

function parseFrontmatter<T>(raw: string): { meta: T; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {} as T, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val: unknown = line.slice(idx + 1).trim();
    if (val === "null") val = null;
    else if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (val === "[]") val = [];
    else if (typeof val === "string" && val.startsWith("[")) {
      try { val = JSON.parse(val); } catch { /* keep string */ }
    }
    meta[key] = val;
  }
  return { meta: meta as T, body: match[2] };
}

export function readProposalDir(proposalsRoot: string, slug: string): ProposalDetail | null {
  const dir = path.join(proposalsRoot, slug);
  const proposalPath = path.join(dir, "PROPOSAL.md");
  if (!fs.existsSync(proposalPath)) return null;

  const raw = fs.readFileSync(proposalPath, "utf8");
  const { meta, body } = parseFrontmatter<ProposalFrontmatter>(raw);

  let impact: string | null = null;
  const impactPath = path.join(dir, "impact.md");
  if (fs.existsSync(impactPath)) {
    impact = fs.readFileSync(impactPath, "utf8");
  }

  const tasks: TaskFile[] = [];
  const entries = fs.readdirSync(dir).filter((f) => /^\d+-/.test(f) && f.endsWith(".md")).sort();
  for (const filename of entries) {
    const num = parseInt(filename, 10);
    const taskRaw = fs.readFileSync(path.join(dir, filename), "utf8");
    const { meta: taskMeta, body: taskBody } = parseFrontmatter<TaskFrontmatter>(taskRaw);
    tasks.push({
      number: num,
      filename,
      name: taskMeta.task ?? filename.replace(/^\d+-/, "").replace(/\.md$/, ""),
      agent: taskMeta.agent ?? "generalPurpose",
      model: taskMeta.model ?? "default",
      dependsOn: taskMeta.depends_on ?? [],
      status: taskMeta.status ?? "pending",
      content: taskBody,
    });
  }

  const tasksByStatus: Record<string, number> = {};
  for (const t of tasks) {
    tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
  }

  return {
    slug,
    title: meta.title ?? slug,
    date: meta.date ?? "",
    status: meta.status ?? "draft",
    repo: meta.repo ?? "",
    ticket: meta.ticket ?? null,
    taskCount: tasks.length,
    tasksByStatus,
    proposal: body,
    impact,
    tasks,
  };
}

export function buildPrompt(detail: ProposalDetail, taskNumber?: number): string {
  const relPath = `docs/proposals/${detail.slug}`;
  const parts: string[] = [
    "You are building a feature based on a design proposal.",
    "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
    `The proposal lives in ${relPath}/`,
    "",
    "# Proposal",
    `<!-- source: ${relPath}/PROPOSAL.md -->`,
    "",
    detail.proposal.trim(),
  ];

  if (detail.impact) {
    parts.push("", "# Impact Analysis", `<!-- source: ${relPath}/impact.md -->`, "", detail.impact.trim());
  }

  if (taskNumber !== undefined) {
    const task = detail.tasks.find((t) => t.number === taskNumber);
    if (!task) throw new Error(`Task ${taskNumber} not found`);
    parts.push("", `# Your Task (#${taskNumber})`, `<!-- source: ${relPath}/${task.filename} -->`, "", task.content.trim());
  } else if (detail.tasks.length > 0) {
    parts.push("", "# Tasks", "");
    for (const task of detail.tasks) {
      parts.push(`## Task ${task.number}: ${task.filename}`, `<!-- source: ${relPath}/${task.filename} -->`, "", task.content.trim(), "");
    }
  }

  parts.push(
    "",
    "Implement this proposal. Work through the tasks in order, respecting dependencies. Run validation (ctx workspace check) before finishing.",
    `Update task status in ${relPath}/ as you complete each task.`,
  );

  return parts.join("\n");
}

export function editPrompt(detail: ProposalDetail, taskNumber?: number): string {
  const relPath = `docs/proposals/${detail.slug}`;

  if (taskNumber !== undefined) {
    const task = detail.tasks.find((t) => t.number === taskNumber);
    if (!task) throw new Error(`Task ${taskNumber} not found`);
    return [
      "You are editing a task file within a proposal.",
      "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
      "",
      "# Proposal Context",
      `<!-- source: ${relPath}/PROPOSAL.md -->`,
      "",
      detail.proposal.trim(),
      "",
      "# Task to Edit",
      `<!-- source: ${relPath}/${task.filename} -->`,
      "",
      task.content.trim(),
      "",
      `Edit the task file at ${relPath}/${task.filename} based on the user's instructions.`,
      "Preserve the frontmatter format. The user will tell you what to change.",
    ].join("\n");
  }

  return [
    "You are editing a design proposal.",
    "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
    "",
    "# Current Proposal",
    `<!-- source: ${relPath}/PROPOSAL.md -->`,
    "",
    detail.proposal.trim(),
    "",
    `Edit the proposal at ${relPath}/PROPOSAL.md based on the user's instructions.`,
    "Preserve the frontmatter format. The user will tell you what to change.",
  ].join("\n");
}

export function evaluatePrompt(detail: ProposalDetail): string {
  const parts: string[] = [
    "# Proposal: " + detail.title,
    `Status: ${detail.status} | Repo: ${detail.repo || "root"} | Tasks: ${detail.taskCount}`,
    "",
    detail.proposal.trim(),
  ];

  if (detail.impact) {
    parts.push("", "## Impact Analysis", "", detail.impact.trim());
  }

  if (detail.tasks.length > 0) {
    parts.push("", "## Tasks", "");
    for (const task of detail.tasks) {
      parts.push(`### ${task.number}. ${task.name} [${task.status}]`, task.content.trim(), "");
    }
  }

  return parts.join("\n");
}

const EVALUATE_SYSTEM = `You are a senior engineer reviewing a proposal. Based ONLY on the proposal content provided, evaluate:

1. **Verdict**: Is this proposal still needed, already done, or obsolete? Pick one: KEEP, COMPLETED, REJECT.
2. **Reasoning**: Why? (2-3 sentences max)
3. **Suggestions**: If KEEP, any scope or task changes worth making? (brief bullets)

You have NO access to the codebase, tools, or shell. Do not attempt to run commands or check files. Analyze only the proposal text provided. If the proposal's own status or content indicates completion, say so.

Respond in markdown. Be direct.`;

function setStatus(proposalsRoot: string, slug: string, status: string, taskNum?: number): void {
  const dir = path.join(proposalsRoot, slug);
  let filePath: string;

  if (taskNum !== undefined) {
    const prefix = String(taskNum).padStart(2, "0") + "-";
    const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".md"));
    if (!match) return;
    filePath = path.join(dir, match);
  } else {
    filePath = path.join(dir, "PROPOSAL.md");
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const updated = raw.replace(/^(status:\s*).*$/m, `$1${status}`);
  fs.writeFileSync(filePath, updated, "utf8");
}

export function registerProposalRoutes(app: FastifyInstance, root: string, mqttClient: CtxMqttClient): void {
  const proposalsRoot = path.join(root, "docs", "proposals");

  app.get("/api/proposals", async () => {
    if (!fs.existsSync(proposalsRoot)) return [];
    const dirs = fs.readdirSync(proposalsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const results: ProposalSummary[] = [];
    for (const slug of dirs) {
      const detail = readProposalDir(proposalsRoot, slug);
      if (!detail) continue;
      const { proposal, impact, tasks, ...summary } = detail;
      results.push(summary);
    }
    return results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  });

  app.get<{ Params: { slug: string } }>(
    "/api/proposals/:slug",
    async (req, reply) => {
      const detail = readProposalDir(proposalsRoot, req.params.slug);
      if (!detail) return reply.code(404).send({ error: "Proposal not found" });
      return detail;
    },
  );

  app.patch<{ Params: { slug: string }; Body: { status: string } }>(
    "/api/proposals/:slug",
    async (req, reply) => {
      const { slug } = req.params;
      const { status } = req.body;
      if (!status) return reply.code(400).send({ error: "status is required" });
      const dir = path.join(proposalsRoot, slug);
      if (!fs.existsSync(dir)) return reply.code(404).send({ error: "Proposal not found" });
      setStatus(proposalsRoot, slug, status);
      return { ok: true, slug, status };
    },
  );

  app.patch<{ Params: { slug: string; taskNum: string }; Body: { status: string } }>(
    "/api/proposals/:slug/tasks/:taskNum",
    async (req, reply) => {
      const { slug, taskNum } = req.params;
      const { status } = req.body;
      if (!status) return reply.code(400).send({ error: "status is required" });

      const dir = path.join(proposalsRoot, slug);
      if (!fs.existsSync(dir)) return reply.code(404).send({ error: "Proposal not found" });

      const entries = fs.readdirSync(dir).filter((f) => f.startsWith(`${taskNum.padStart(2, "0")}-`));
      if (entries.length === 0) return reply.code(404).send({ error: "Task not found" });

      const filePath = path.join(dir, entries[0]);
      const raw = fs.readFileSync(filePath, "utf8");
      const updated = raw.replace(/^(status:\s*).*$/m, `$1${status}`);
      fs.writeFileSync(filePath, updated, "utf8");
      return { ok: true, task: parseInt(taskNum, 10), status };
    },
  );

  app.post<{ Params: { slug: string }; Body: { task?: number; agent?: string } }>(
    "/api/proposals/:slug/build",
    async (req, reply) => {
      const { slug } = req.params;
      const { task: taskNum, agent = "claude" } = req.body ?? {};

      const detail = readProposalDir(proposalsRoot, slug);
      if (!detail) return reply.code(404).send({ error: "Proposal not found" });

      let prompt: string;
      try {
        prompt = buildPrompt(detail, taskNum);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(400).send({ error: msg });
      }

      // Write prompt to temp file
      const os = await import("os");
      const suffix = taskNum !== undefined ? `-task-${taskNum}` : "";
      const promptPath = path.join(os.tmpdir(), `ctx-proposal-${slug}${suffix}-${Date.now()}.md`);
      fs.writeFileSync(promptPath, prompt, "utf8");

      const { spawnSession } = await import("../terminal/manager.js");
      const cmd = agent === "codex" ? "codex" : "claude";
      const args = cmd === "claude"
        ? ["--append-system-prompt", prompt]
        : [prompt];

      const session = await spawnSession({ command: cmd, args, cwd: root });

      // Update statuses
      setStatus(proposalsRoot, slug, "in-progress");
      if (taskNum !== undefined) {
        setStatus(proposalsRoot, slug, "in-progress", taskNum);
      }

      return {
        sessionId: session.id,
        slug,
        task: taskNum ?? null,
        agent: cmd,
        promptPath,
      };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    "/api/proposals/:slug",
    async (req, reply) => {
      const dir = path.join(proposalsRoot, req.params.slug);
      if (!fs.existsSync(dir)) return reply.code(404).send({ error: "Proposal not found" });
      fs.rmSync(dir, { recursive: true, force: true });
      return { ok: true, slug: req.params.slug };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/api/proposals/:slug/evaluate",
    async (req, reply) => {
      const { slug } = req.params;
      const detail = readProposalDir(proposalsRoot, slug);
      if (!detail) return reply.code(404).send({ error: "Proposal not found" });

      const evalTopic = TOPICS.proposals.eval(slug);
      const doneTopic = TOPICS.proposals.evalDone(slug);
      const prompt = evaluatePrompt(detail);

      // Fire and forget — tokens stream via MQTT
      const { stream: aiStream } = await import("../ai/client.js");
      aiStream(
        { prompt, system: EVALUATE_SYSTEM, maxTokens: 2048 },
        {
          onToken(text) {
            mqttClient.publish(evalTopic, { text });
          },
          onDone(response) {
            mqttClient.publish(doneTopic, {
              model: response.model,
              provider: response.provider,
              tokens: { input: response.inputTokens, output: response.outputTokens },
            });
          },
          onError(error) {
            mqttClient.publish(doneTopic, { error: error.message });
          },
        },
      );

      return { slug, topic: evalTopic };
    },
  );

  app.post<{ Body: { description: string } }>(
    "/api/proposals",
    async (req, reply) => {
      const { description } = req.body ?? {};
      if (!description?.trim()) return reply.code(400).send({ error: "description is required" });

      const skillPath = path.join(root, "skills", "proposals", "SKILL.md");
      let skillContext = "";
      if (fs.existsSync(skillPath)) {
        skillContext = fs.readFileSync(skillPath, "utf8");
      }

      const prompt = [
        "You are creating a new design proposal based on the user's description.",
        "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
        "",
        "# Proposals Skill Reference",
        "",
        skillContext,
        "",
        "# User's Request",
        "",
        description.trim(),
        "",
        "# Instructions",
        "",
        "1. Analyze the request and ask clarifying questions if anything is ambiguous.",
        "2. Once you have enough context, create the proposal directory under docs/proposals/<slug>/",
        "3. Write PROPOSAL.md with proper frontmatter (status: draft, date: today).",
        "4. Write impact.md listing affected files, systems, and risks.",
        "5. Break the work into numbered task files (01-<name>.md, 02-<name>.md, etc.).",
        "6. Present the proposal summary to the user for feedback before finishing.",
        "",
        "Be thorough but concise. Ask the user questions to refine scope before writing files.",
      ].join("\n");

      const { spawnSession } = await import("../terminal/manager.js");
      const session = await spawnSession({
        command: "claude",
        args: ["--append-system-prompt", prompt],
        cwd: root,
      });

      return { sessionId: session.id };
    },
  );

  app.post<{ Params: { slug: string }; Body: { task?: number } }>(
    "/api/proposals/:slug/edit",
    async (req, reply) => {
      const { slug } = req.params;
      const { task: taskNum } = req.body ?? {};

      const detail = readProposalDir(proposalsRoot, slug);
      if (!detail) return reply.code(404).send({ error: "Proposal not found" });

      let prompt: string;
      try {
        prompt = editPrompt(detail, taskNum);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(400).send({ error: msg });
      }

      const os = await import("os");
      const suffix = taskNum !== undefined ? `-task-${taskNum}` : "";
      const promptPath = path.join(os.tmpdir(), `ctx-proposal-edit-${slug}${suffix}-${Date.now()}.md`);
      fs.writeFileSync(promptPath, prompt, "utf8");

      const { spawnSession } = await import("../terminal/manager.js");
      const session = await spawnSession({
        command: "claude",
        args: ["--append-system-prompt", prompt],
        cwd: root,
      });

      return {
        sessionId: session.id,
        slug,
        task: taskNum ?? null,
        promptPath,
      };
    },
  );
}
