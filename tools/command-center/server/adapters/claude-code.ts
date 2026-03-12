import fs from "fs";
import path from "path";
import type { IdeAdapter, SyncResult, LaunchResult } from "./types.js";

function collectRules(rulesDir: string): string[] {
  if (!fs.existsSync(rulesDir)) return [];
  return fs
    .readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => fs.readFileSync(path.join(rulesDir, f), "utf-8").trim())
    .filter(Boolean);
}

function collectSkills(skillsDir: string): string[] {
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
    const rules = collectRules(path.join(root, "rules"));
    const skills = collectSkills(path.join(root, "skills"));

    const sections = [
      "# AGENTS.md",
      "",
      "Auto-generated from canonical workspace. Do not edit directly.",
      "",
      "## Rules",
      "",
      ...rules,
      "",
      "## Skills",
      "",
      ...skills,
    ];

    const agentsPath = path.join(root, "AGENTS.md");
    fs.writeFileSync(agentsPath, sections.join("\n") + "\n", "utf-8");
    written.push(agentsPath);

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
