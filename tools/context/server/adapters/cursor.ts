import fs from "fs";
import path from "path";
import type { IdeAdapter, SyncResult, LaunchResult } from "./types.js";

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

function removeStale(canonical: string, derived: string, removed: string[]): void {
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

export const cursorAdapter: IdeAdapter = {
  name: "cursor",

  detect(root: string): boolean {
    return fs.existsSync(path.join(root, ".cursor"));
  },

  sync(root: string): SyncResult {
    const written: string[] = [];
    const removed: string[] = [];

    const rulesCanonical = path.join(root, "rules");
    const rulesDerived = path.join(root, ".cursor", "rules");
    if (fs.existsSync(rulesCanonical)) {
      copyDir(rulesCanonical, rulesDerived, written);
      removeStale(rulesCanonical, rulesDerived, removed);
    }

    const skillsCanonical = path.join(root, "skills");
    const skillsDerived = path.join(root, ".cursor", "skills");
    if (fs.existsSync(skillsCanonical)) {
      copyDir(skillsCanonical, skillsDerived, written);
      removeStale(skillsCanonical, skillsDerived, removed);
    }

    return { filesWritten: written, filesRemoved: removed };
  },

  launch(root: string): LaunchResult {
    return {
      method: "open",
      value: root,
      label: "Open in Cursor",
    };
  },
};
