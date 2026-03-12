import crypto from "crypto";
import fs from "fs";
import type { FastifyInstance } from "fastify";
import {
  insertProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  getProjectBySlug,
} from "../db/index.js";
import { scaffoldWorkspace, readWorkspaceConfig, workspaceExists } from "../workspace/creator.js";
import { inheritFromParent } from "../workspace/inherit.js";
import { launchIde, listAdapters } from "../adapters/registry.js";
import { scaffoldIntelligence } from "./scaffold.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

interface CreateBody {
  name: string;
  description?: string;
  rootPath: string;
  projectType?: string;
  goals?: string[];
  repos?: Array<{ name: string; url?: string; path?: string }>;
  config?: Record<string, unknown>;
}

interface ImportBody {
  rootPath: string;
  name?: string;
}

interface UpdateBody {
  name?: string;
  description?: string;
  status?: string;
  config?: Record<string, unknown>;
}

export function registerProjectRoutes(app: FastifyInstance, ctxRoot: string): void {
  app.get("/api/projects", async (req) => {
    const query = req.query as { status?: string };
    return listProjects({ status: query.status ?? "active" });
  });

  app.get<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return project;
    },
  );

  app.post<{ Body: CreateBody }>(
    "/api/projects",
    async (req, reply) => {
      const { name, description, rootPath, projectType, goals, repos: inputRepos, config } = req.body;

      if (!name || !rootPath) {
        return reply.code(400).send({ error: "name and rootPath are required" });
      }

      let slug = slugify(name);
      if (getProjectBySlug(slug)) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const id = generateId();
      const ides = (config as Record<string, unknown>)?.ides as string[] ?? ["cursor"];

      scaffoldWorkspace(rootPath, {
        name,
        version: 1,
        repos: (inputRepos ?? []).map((r) => ({
          name: r.name,
          url: r.url,
          path: r.path,
          branch: "main",
          description: "",
        })),
        ides: ides as Array<"cursor" | "claude-code" | "windsurf" | "codex">,
        appUrl: "http://127.0.0.1:19470",
      });

      const inherited = inheritFromParent(rootPath, ctxRoot);
      console.log(
        `[project] inherited ${inherited.rules} rules, ${inherited.skills} skills from: ${inherited.sources.join(", ")}`,
      );

      if (projectType || (goals && goals.length > 0)) {
        try {
          await scaffoldIntelligence(rootPath, {
            name,
            projectType: projectType ?? "software",
            description: description ?? "",
            goals: goals ?? [],
            repos: inputRepos ?? [],
          });
        } catch {
          // AI scaffolding is best-effort; workspace is still usable without it
        }
      }

      insertProject({
        id,
        name,
        slug,
        description: description ?? "",
        root_path: rootPath,
        status: "active",
        config: JSON.stringify({ ...config, projectType, goals }),
      });

      return getProject(id);
    },
  );

  app.post<{ Body: ImportBody }>(
    "/api/projects/import",
    async (req, reply) => {
      const { rootPath, name: nameOverride } = req.body;
      if (!rootPath) {
        return reply.code(400).send({ error: "rootPath is required" });
      }

      if (!fs.existsSync(rootPath)) {
        return reply.code(400).send({ error: "Directory does not exist" });
      }

      const existing = workspaceExists(rootPath);
      const wsConfig = existing ? readWorkspaceConfig(rootPath) : null;
      const derivedName =
        nameOverride ?? wsConfig?.name ?? rootPath.split("/").filter(Boolean).pop() ?? "Imported";

      let slug = slugify(derivedName);
      if (getProjectBySlug(slug)) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      if (!existing) {
        scaffoldWorkspace(rootPath, {
          name: derivedName,
          version: 1,
          repos: [],
          ides: ["cursor"],
          appUrl: "http://127.0.0.1:19470",
        });
      }

      const inherited = inheritFromParent(rootPath, ctxRoot);
      console.log(
        `[project:import] inherited ${inherited.rules} rules, ${inherited.skills} skills from: ${inherited.sources.join(", ")}`,
      );

      const id = generateId();
      insertProject({
        id,
        name: derivedName,
        slug,
        description: "",
        root_path: rootPath,
        status: "active",
        config: JSON.stringify({
          imported: true,
          hadWorkspace: existing,
          ides: wsConfig?.ides ?? ["cursor"],
        }),
      });

      return getProject(id);
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateBody }>(
    "/api/projects/:id",
    async (req, reply) => {
      const existing = getProject(req.params.id);
      if (!existing) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const fields: Record<string, unknown> = {};
      if (req.body.name !== undefined) fields.name = req.body.name;
      if (req.body.description !== undefined) fields.description = req.body.description;
      if (req.body.status !== undefined) fields.status = req.body.status;
      if (req.body.config !== undefined) fields.config = JSON.stringify(req.body.config);

      updateProject(req.params.id, fields);
      return getProject(req.params.id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (req, reply) => {
      const existing = getProject(req.params.id);
      if (!existing) {
        return reply.code(404).send({ error: "Project not found" });
      }
      deleteProject(req.params.id);
      return { ok: true };
    },
  );

  app.get("/api/ides", async () => {
    return listAdapters().map((a) => ({ name: a.name }));
  });

  app.post<{ Params: { id: string }; Body: { ide: string } }>(
    "/api/projects/:id/launch",
    async (req, reply) => {
      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      try {
        const result = await launchIde(project.root_path, req.body.ide);
        if (!result) return reply.code(400).send({ error: `Unknown IDE: ${req.body.ide}` });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: `Launch failed: ${msg}` });
      }
    },
  );
}
