import fs from "fs";
import path from "path";
import type { IdeAdapter, SyncResult, LaunchResult } from "./types.js";
import { parseFrontmatter, type ParsedMd } from "./frontmatter.js";

interface ParsedRule extends ParsedMd {
  file: string;
}

function readRules(rulesDir: string): ParsedRule[] {
  if (!fs.existsSync(rulesDir)) return [];
  return fs
    .readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({
      file: f,
      ...parseFrontmatter(fs.readFileSync(path.join(rulesDir, f), "utf-8")),
    }))
    .filter((r) => r.body);
}

function collectSkillNames(skillsDir: string): string[] {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(skillsDir, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

function collectSkillSections(skillsDir: string): string[] {
  if (!fs.existsSync(skillsDir)) return [];
  const sections: string[] = [];

  for (const dir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const skillFile = path.join(skillsDir, dir.name, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      const content = fs.readFileSync(skillFile, "utf-8").trim();
      if (content) sections.push(`## Skill: ${dir.name}\n\n${content}`);
    }
  }

  return sections;
}

function readMcpServers(root: string): Record<string, unknown> {
  const mcpPath = path.join(root, ".claude", "mcp.json");
  if (!fs.existsSync(mcpPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    return raw?.mcpServers ?? {};
  } catch {
    return {};
  }
}

function buildMcpSection(servers: Record<string, unknown>): string {
  const names = Object.keys(servers);
  if (names.length === 0) return "";

  const lines = [
    "## MCP Servers",
    "",
    "The following MCP servers are configured and available as tools:",
    "",
  ];

  for (const name of names) {
    const cfg = servers[name] as Record<string, unknown>;
    const cmd = cfg.command ?? "";
    const args = Array.isArray(cfg.args) ? cfg.args.join(" ") : "";
    lines.push(`- **${name}**: \`${cmd} ${args}\``);
  }

  lines.push("");
  lines.push(
    "Use these tools directly. See `skills/<name>/SKILL.md` for usage guidance.",
  );

  return lines.join("\n");
}

function buildClaudeMd(root: string, rules: ParsedRule[]): string {
  const always = rules.filter((r) => r.meta.apply === "always");
  const conditional = rules.filter((r) => r.meta.apply === "conditional");
  const mcpServers = readMcpServers(root);
  const skillNames = collectSkillNames(path.join(root, "skills"));

  const sections: string[] = [
    "# Context -- AI Agent Workspace Framework",
    "",
    "You are an agent operating inside a Context workspace -- a poly-repo",
    "coordination layer with an MQTT message bus and persistent memory. No emojis in",
    "code.",
    "",
    "## Navigation",
    "",
    "- Read `AGENTS.md` for system architecture, repo map, and workspace rules.",
    "- Read `rules/` for the full set of workspace rules (shared across all AI tools).",
    "- Read `docs/proposals/` for feature proposals and design docs.",
    "",
    "## Operational Rules",
    "",
    "- DO NOT run servers or long-running processes directly. Prompt the user to do so.",
    "- DO NOT write docs or summaries unless explicitly asked.",
  ];

  // MCP awareness
  const mcpSection = buildMcpSection(mcpServers);
  if (mcpSection) {
    sections.push("", mcpSection);
  }

  // Skills index
  if (skillNames.length > 0) {
    sections.push(
      "",
      "## Available Skills",
      "",
      "Read `skills/<name>/SKILL.md` for details on any skill.",
      "",
      ...skillNames.map((s) => `- ${s}`),
    );
  }

  // Always-apply rules inlined
  if (always.length > 0) {
    sections.push(
      "",
      "## Always-Apply Rules",
      "",
      "The following rules apply to every session. They are extracted from `rules/`",
      "so you don't need to read them separately.",
    );

    for (const rule of always) {
      sections.push("", "---", "", rule.body);
    }

    sections.push("", "---");
  }

  // Conditional rules table
  if (conditional.length > 0) {
    sections.push("", "## Conditional Rules", "", "Read these from `rules/` when the task requires them:", "", "| Rule | When to read |", "|------|-------------|");

    for (const rule of conditional) {
      const name = rule.file.replace(/\.md$/, "");
      const when = rule.meta.when ?? "";
      sections.push(`| \`rules/${rule.file}\` | ${when} |`);
    }
  }

  // Memory protocol
  sections.push(
    "",
    "## Memory Protocol",
    "",
    "Before substantial work, scan `memory/` for relevant context (decisions,",
    "progress, known issues). Write memory proactively -- see `rules/memory.md`",
    "for the full protocol.",
    "",
  );

  return sections.join("\n");
}

function buildAgentsMd(rules: ParsedRule[], skills: string[]): string {
  const sections = [
    "# AGENTS.md",
    "",
    "Auto-generated from canonical workspace. Do not edit directly.",
    "",
    "## Rules",
    "",
    ...rules.map((r) => r.body),
    "",
    "## Skills",
    "",
    ...skills,
  ];

  return sections.join("\n") + "\n";
}

function copyDir(src: string, dest: string, written: string[]): void {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, written);
    } else {
      fs.copyFileSync(srcPath, destPath);
      written.push(destPath);
    }
  }
}

function removeStale(
  canonical: string,
  derived: string,
  removed: string[],
): void {
  if (!fs.existsSync(derived)) return;

  for (const entry of fs.readdirSync(derived, { withFileTypes: true })) {
    const derivedPath = path.join(derived, entry.name);
    const canonicalPath = path.join(canonical, entry.name);

    if (entry.isDirectory()) {
      removeStale(canonicalPath, derivedPath, removed);
    } else if (!fs.existsSync(canonicalPath)) {
      fs.unlinkSync(derivedPath);
      removed.push(derivedPath);
    }
  }
}

export const claudeCodeAdapter: IdeAdapter = {
  name: "claude-code",

  detect(root: string): boolean {
    return (
      fs.existsSync(path.join(root, "AGENTS.md")) ||
      fs.existsSync(path.join(root, "CLAUDE.md"))
    );
  },

  sync(root: string): SyncResult {
    const written: string[] = [];
    const removed: string[] = [];
    const rules = readRules(path.join(root, "rules"));
    const skillSections = collectSkillSections(path.join(root, "skills"));

    // Generate CLAUDE.md
    const claudePath = path.join(root, "CLAUDE.md");
    fs.writeFileSync(claudePath, buildClaudeMd(root, rules), "utf-8");
    written.push(claudePath);

    // Generate AGENTS.md
    const agentsPath = path.join(root, "AGENTS.md");
    fs.writeFileSync(agentsPath, buildAgentsMd(rules, skillSections), "utf-8");
    written.push(agentsPath);

    // Mirror skills to .agents/skills/
    const skillsCanonical = path.join(root, "skills");
    const skillsDerived = path.join(root, ".agents", "skills");
    if (fs.existsSync(skillsCanonical)) {
      copyDir(skillsCanonical, skillsDerived, written);
      removeStale(skillsCanonical, skillsDerived, removed);
    }

    return { filesWritten: written, filesRemoved: removed };
  },

  launch(root: string): LaunchResult {
    return {
      method: "pty",
      value: "claude",
      args: ["--dangerously-skip-permissions"],
      label: "Claude Code",
    };
  },
};
