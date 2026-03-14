import fs from "fs";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { spawnSession } from "../../terminal/manager.js";

interface ProposalMeta {
  slug: string;
  title: string;
  status: string;
  taskCount: number;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return meta;
}

function listProposals(root: string): ProposalMeta[] {
  const dir = path.join(root, "docs", "proposals");
  if (!fs.existsSync(dir)) return [];

  const results: ProposalMeta[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const proposalPath = path.join(dir, entry.name, "PROPOSAL.md");
    if (!fs.existsSync(proposalPath)) continue;

    const meta = parseFrontmatter(fs.readFileSync(proposalPath, "utf8"));
    const taskCount = fs.readdirSync(path.join(dir, entry.name))
      .filter((f) => /^\d+-/.test(f) && f.endsWith(".md")).length;

    results.push({
      slug: entry.name,
      title: meta.title ?? entry.name,
      status: meta.status ?? "draft",
      taskCount,
    });
  }
  return results;
}

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_proposal_list",
    "List all design proposals in the workspace with their status and task count.",
    {},
    async () => {
      const proposals = listProposals(root);
      if (proposals.length === 0) {
        return { content: [{ type: "text" as const, text: "No proposals found." }] };
      }
      const lines = proposals.map(
        (p) => `${p.slug} [${p.status}] (${p.taskCount} tasks) -- ${p.title}`,
      );
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_proposal_build",
    "Dispatch an AI agent to build a proposal. Spawns a terminal session with Claude or Codex working on the proposal (or a specific task). Returns the terminal session ID.",
    {
      slug: z.string().describe("Proposal directory name (e.g. 'embedded-terminal')"),
      task: z.number().int().optional().describe("Specific task number to build (omit for full proposal)"),
      agent: z.enum(["claude", "codex"]).default("claude").describe("Which AI agent to use"),
    },
    async ({ slug, task, agent }) => {
      const { readProposalDir, buildPrompt } = await import("../../routes/proposals.js");

      const proposalsRoot = path.join(root, "docs", "proposals");
      const detail = readProposalDir(proposalsRoot, slug);
      if (!detail) {
        return { content: [{ type: "text" as const, text: `Proposal not found: ${slug}` }], isError: true };
      }

      let prompt: string;
      try {
        prompt = buildPrompt(detail, task);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }

      const os = await import("os");
      const suffix = task !== undefined ? `-task-${task}` : "";
      const promptPath = path.join(os.default.tmpdir(), `ctx-proposal-${slug}${suffix}-${Date.now()}.md`);
      fs.writeFileSync(promptPath, prompt, "utf8");

      const cmd = agent === "codex" ? "codex" : "claude";
      const taskLabel = task !== undefined ? ` task ${task}` : "";
      const userPrompt = `Build the proposal "${detail.title}"${taskLabel}. Follow the instructions in your system prompt.`;
      const args = cmd === "claude"
        ? ["--append-system-prompt", prompt, userPrompt]
        : [prompt];
      const session = await spawnSession({ command: cmd, args, cwd: root });

      const taskSuffix = task !== undefined ? ` (task ${task})` : "";
      return {
        content: [{
          type: "text" as const,
          text: `Dispatched ${cmd} to build ${slug}${taskSuffix}.\nTerminal session: ${session.id}\nView in Command Center: /terminal?session=${session.id}`,
        }],
      };
    },
  );
}
