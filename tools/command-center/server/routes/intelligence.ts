import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import { getProject } from "../db/index.js";
import {
  listDir,
  listSkillDirs,
  listMemoryFiles,
  triggerSync,
} from "./intel-helpers.js";

function resolveProject(app: FastifyInstance, id: string) {
  const project = getProject(id);
  if (!project) return null;
  return project;
}

export function registerIntelligenceRoutes(app: FastifyInstance): void {
  // --- Rules ---
  app.get<{ Params: { id: string } }>("/api/projects/:id/rules", async (req, reply) => {
    const project = resolveProject(app, req.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found" });
    return listDir(path.join(project.root_path, "rules"), ".md");
  });

  app.post<{ Params: { id: string }; Body: { name: string; content: string } }>(
    "/api/projects/:id/rules",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const rulesDir = path.join(project.root_path, "rules");
      fs.mkdirSync(rulesDir, { recursive: true });
      const filename = req.body.name.endsWith(".md") ? req.body.name : `${req.body.name}.md`;
      fs.writeFileSync(path.join(rulesDir, filename), req.body.content, "utf-8");
      triggerSync(project.root_path, project.config);
      return { ok: true, name: filename.replace(".md", "") };
    },
  );

  app.patch<{ Params: { id: string; name: string }; Body: { content: string } }>(
    "/api/projects/:id/rules/:name",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const filePath = path.join(project.root_path, "rules", `${req.params.name}.md`);
      if (!fs.existsSync(filePath)) return reply.code(404).send({ error: "Rule not found" });

      fs.writeFileSync(filePath, req.body.content, "utf-8");
      triggerSync(project.root_path, project.config);
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string; name: string } }>(
    "/api/projects/:id/rules/:name",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const filePath = path.join(project.root_path, "rules", `${req.params.name}.md`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      triggerSync(project.root_path, project.config);
      return { ok: true };
    },
  );

  // --- Skills ---
  app.get<{ Params: { id: string } }>("/api/projects/:id/skills", async (req, reply) => {
    const project = resolveProject(app, req.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found" });
    return listSkillDirs(path.join(project.root_path, "skills"));
  });

  app.post<{ Params: { id: string }; Body: { name: string; content: string } }>(
    "/api/projects/:id/skills",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const skillDir = path.join(project.root_path, "skills", req.body.name);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), req.body.content, "utf-8");
      triggerSync(project.root_path, project.config);
      return { ok: true, name: req.body.name };
    },
  );

  app.patch<{ Params: { id: string; name: string }; Body: { content: string } }>(
    "/api/projects/:id/skills/:name",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const filePath = path.join(project.root_path, "skills", req.params.name, "SKILL.md");
      if (!fs.existsSync(filePath)) return reply.code(404).send({ error: "Skill not found" });

      fs.writeFileSync(filePath, req.body.content, "utf-8");
      triggerSync(project.root_path, project.config);
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string; name: string } }>(
    "/api/projects/:id/skills/:name",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const skillDir = path.join(project.root_path, "skills", req.params.name);
      if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true });
      triggerSync(project.root_path, project.config);
      return { ok: true };
    },
  );

  // --- Memory ---
  app.get<{ Params: { id: string } }>("/api/projects/:id/memory", async (req, reply) => {
    const project = resolveProject(app, req.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const query = req.query as { category?: string; q?: string };
    return listMemoryFiles(
      path.join(project.root_path, "memory"),
      query.category,
      query.q,
    );
  });

  app.post<{
    Params: { id: string };
    Body: { category: string; name: string; content: string };
  }>("/api/projects/:id/memory", async (req, reply) => {
    const project = resolveProject(app, req.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const dir = path.join(project.root_path, "memory", req.body.category);
    fs.mkdirSync(dir, { recursive: true });
    const filename = req.body.name.endsWith(".md") ? req.body.name : `${req.body.name}.md`;
    fs.writeFileSync(path.join(dir, filename), req.body.content, "utf-8");
    return { ok: true, name: `${req.body.category}/${filename.replace(".md", "")}` };
  });

  app.delete<{ Params: { id: string; name: string } }>(
    "/api/projects/:id/memory/:name",
    async (req, reply) => {
      const project = resolveProject(app, req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const [category, filename] = req.params.name.split("/");
      if (!category || !filename) return reply.code(400).send({ error: "Invalid memory name" });

      const filePath = path.join(project.root_path, "memory", category, `${filename}.md`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { ok: true };
    },
  );
}
