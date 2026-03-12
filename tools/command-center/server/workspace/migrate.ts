import fs from "fs";
import path from "path";

function copyTree(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyTree(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
  }

  return count;
}

export interface MigrationResult {
  rulesCount: number;
  skillsCount: number;
  alreadyMigrated: boolean;
}

export function needsMigration(root: string): boolean {
  const hasOldRules = fs.existsSync(path.join(root, ".cursor", "rules"));
  const hasCanonical = fs.existsSync(path.join(root, "rules"));
  return hasOldRules && !hasCanonical;
}

export function migrateWorkspace(root: string): MigrationResult {
  if (!needsMigration(root)) {
    return { rulesCount: 0, skillsCount: 0, alreadyMigrated: true };
  }

  const rulesCount = copyTree(
    path.join(root, ".cursor", "rules"),
    path.join(root, "rules"),
  );

  const skillsCount = copyTree(
    path.join(root, ".cursor", "skills"),
    path.join(root, "skills"),
  );

  return { rulesCount, skillsCount, alreadyMigrated: false };
}
