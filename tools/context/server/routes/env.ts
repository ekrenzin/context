import type { FastifyInstance } from "fastify";
import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

interface DepStatus {
  name: string;
  installed: boolean;
  group: string;
}

interface EnvStatus {
  pythonVersion: string | null;
  cliInstalled: boolean;
  venvExists: boolean;
  deps: DepStatus[];
}

const OPTIONAL_DEPS: Array<{ module: string; name: string; group: string }> = [
  { module: "boto3", name: "boto3", group: "aws" },
  { module: "msal", name: "msal", group: "teams" },
  { module: "requests", name: "requests", group: "teams" },
  { module: "openai", name: "openai", group: "image" },
  { module: "PIL", name: "Pillow", group: "image" },
];

function ctxBin(root: string): string {
  return process.platform === "win32"
    ? path.join(root, "tools", ".venv", "Scripts", "ctx.exe")
    : path.join(root, "tools", ".venv", "bin", "ctx");
}

function venvPython(root: string): string {
  return process.platform === "win32"
    ? path.join(root, "tools", ".venv", "Scripts", "python.exe")
    : path.join(root, "tools", ".venv", "bin", "python");
}

function checkEnv(root: string): EnvStatus {
  let pythonVersion: string | null = null;
  try {
    const out = execFileSync("python3", ["--version"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    pythonVersion = out.replace("Python ", "");
  } catch {
    try {
      const out = execFileSync("python", ["--version"], {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      pythonVersion = out.replace("Python ", "");
    } catch { /* no python */ }
  }

  const venvExists = fs.existsSync(path.join(root, "tools", ".venv"));
  const cliInstalled = fs.existsSync(ctxBin(root));

  const deps: DepStatus[] = [];
  const py = venvPython(root);
  if (fs.existsSync(py)) {
    for (const dep of OPTIONAL_DEPS) {
      try {
        execFileSync(py, ["-c", `import ${dep.module}`], {
          timeout: 5000,
          stdio: "pipe",
        });
        deps.push({ name: dep.name, installed: true, group: dep.group });
      } catch {
        deps.push({ name: dep.name, installed: false, group: dep.group });
      }
    }
  } else {
    for (const dep of OPTIONAL_DEPS) {
      deps.push({ name: dep.name, installed: false, group: dep.group });
    }
  }

  return { pythonVersion, cliInstalled, venvExists, deps };
}

export function registerEnvRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/env", async () => {
    return checkEnv(root);
  });

  app.post<{ Body: { extras?: string } }>("/api/env/bootstrap", async (req, reply) => {
    const extras = req.body?.extras ?? null;
    const bootstrap = path.join(root, "tools", "bootstrap.py");

    if (!fs.existsSync(bootstrap)) {
      return reply.code(404).send({ error: "bootstrap.py not found" });
    }

    const python = process.platform === "win32" ? "python" : "python3";
    const args = [bootstrap];
    if (extras) {
      args.push("--extras", extras);
    }

    return new Promise((resolve) => {
      const lines: string[] = [];
      const proc = spawn(python, args, { cwd: root, stdio: "pipe" });

      proc.stdout.on("data", (chunk: Buffer) => {
        lines.push(...chunk.toString().split("\n").filter(Boolean));
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        lines.push(...chunk.toString().split("\n").filter(Boolean));
      });

      proc.on("close", (code) => {
        const status = checkEnv(root);
        resolve(
          reply.send({
            success: code === 0,
            exitCode: code,
            output: lines.join("\n"),
            env: status,
          }),
        );
      });

      proc.on("error", (err) => {
        resolve(
          reply.code(500).send({
            success: false,
            exitCode: -1,
            output: err.message,
            env: checkEnv(root),
          }),
        );
      });
    });
  });
}
