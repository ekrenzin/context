import { exec } from "child_process";
import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { MigrateEnvironment, MigrateResult } from "../types.js";

function discoverMigrationScripts(root: string): MigrateEnvironment[] {
  const pkgPath = path.join(root, "repos", "app-platform", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const scripts: Record<string, string> = pkg.scripts ?? {};
    const envs: MigrateEnvironment[] = [];

    for (const [name, cmd] of Object.entries(scripts)) {
      if (!name.startsWith("db:migrate")) continue;
      if (name === "db:migrate:undo") continue;

      const suffix = name.replace("db:migrate", "").replace(/^:/, "");
      const label = suffix
        ? suffix.split(/[-:]/).map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")
        : "Development";

      envs.push({ label, script: name, command: cmd });
    }

    return envs;
  } catch {
    return [];
  }
}

function runMigration(
  cwd: string,
  script: string,
  undo: boolean,
): Promise<MigrateResult> {
  const target = undo ? "db:migrate:undo" : script;
  return new Promise((resolve) => {
    exec(
      `npm run ${target}`,
      { cwd, timeout: 120_000, maxBuffer: 1024 * 512 },
      (error, stdout, stderr) => {
        resolve({
          success: !error,
          exitCode: error?.code ?? 0,
          output: (stdout + "\n" + stderr).trim(),
        });
      },
    );
  });
}

export function registerPlatformRoutes(
  app: FastifyInstance,
  root: string,
): void {
  const platformDir = path.join(root, "repos", "app-platform");

  app.get("/api/platform/migrate/environments", async (_req, reply) => {
    if (!fs.existsSync(platformDir)) {
      reply.code(404).send({ error: "app-platform repo not found" });
      return;
    }
    return discoverMigrationScripts(root);
  });

  app.post<{ Body: { script: string; undo?: boolean } }>(
    "/api/platform/migrate",
    async (req, reply) => {
      if (!fs.existsSync(platformDir)) {
        reply.code(404).send({ error: "app-platform repo not found" });
        return;
      }

      const { script, undo } = req.body ?? {};
      if (!script || typeof script !== "string") {
        reply.code(400).send({ error: "script is required" });
        return;
      }

      const envs = discoverMigrationScripts(root);
      const valid = envs.some((e) => e.script === script);
      if (!valid && script !== "db:migrate:undo") {
        reply.code(400).send({ error: `Unknown migration script: ${script}` });
        return;
      }

      const result = await runMigration(platformDir, script, undo === true);
      reply.code(result.success ? 200 : 500).send(result);
    },
  );
}
