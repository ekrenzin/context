import fs from "fs";
import path from "path";
import os from "os";

interface InheritSources {
  rootWorkspace: string;
  userSkillsDir: string;
}

function resolveDefaults(ctxRoot: string): InheritSources {
  return {
    rootWorkspace: ctxRoot,
    userSkillsDir: path.join(os.homedir(), ".cursor", "skills-cursor"),
  };
}

function copyDirRecursive(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  let count = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

function copyRules(srcDir: string, destDir: string): number {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;

  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith(".mdc") && !file.endsWith(".md")) continue;
    const destName = file.endsWith(".mdc") ? file.replace(".mdc", ".md") : file;
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, destName));
    count++;
  }

  return count;
}

function copySkills(srcDir: string, destDir: string): number {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(srcDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    const destSkillDir = path.join(destDir, entry.name);
    if (fs.existsSync(destSkillDir)) continue;

    fs.mkdirSync(destSkillDir, { recursive: true });
    count += copyDirRecursive(path.join(srcDir, entry.name), destSkillDir);
  }

  return count;
}

export interface InheritResult {
  rules: number;
  skills: number;
  sources: string[];
}

export function inheritFromParent(
  projectRoot: string,
  ctxRoot: string,
): InheritResult {
  const sources = resolveDefaults(ctxRoot);
  const result: InheritResult = { rules: 0, skills: 0, sources: [] };
  const destRules = path.join(projectRoot, "rules");
  const destSkills = path.join(projectRoot, "skills");

  const rootRulesDir = path.join(sources.rootWorkspace, ".cursor", "rules");
  if (fs.existsSync(rootRulesDir)) {
    result.rules += copyRules(rootRulesDir, destRules);
    result.sources.push("root-workspace-rules");
  }

  const rootSkillsDir = path.join(sources.rootWorkspace, ".cursor", "skills");
  if (fs.existsSync(rootSkillsDir)) {
    result.skills += copySkills(rootSkillsDir, destSkills);
    result.sources.push("root-workspace-skills");
  }

  if (fs.existsSync(sources.userSkillsDir)) {
    result.skills += copySkills(sources.userSkillsDir, destSkills);
    result.sources.push("user-cursor-skills");
  }

  return result;
}
