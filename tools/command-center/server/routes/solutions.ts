import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import * as esbuild from "esbuild";
import { buildSolution } from "../solutions/builder.js";
import {
  listSolutions,
  getSolution,
  createSolution,
  updateStatus,
  deleteSolution,
} from "../solutions/index.js";
import { getHealth, getServicePort, activateSolution, deactivateSolution } from "../solutions/runtime/index.js";
import { getProject } from "../db/index.js";

/** Cache compiled view bundles keyed by solution id. */
const viewCache = new Map<string, { js: string; mtime: number }>();

function solutionDir(
  sol: { name: string; project_id: string | null },
  root: string,
): string {
  const base = sol.project_id
    ? (getProject(sol.project_id)?.root_path ?? root)
    : root;
  return path.join(base, "solutions", sol.name);
}

export function registerSolutionRoutes(app: FastifyInstance, root: string): void {
  const cmdCenterDir = path.join(root, "tools", "command-center");
  app.get("/api/solutions", async () => listSolutions(null));

  app.get<{ Params: { projectId: string } }>(
    "/api/projects/:projectId/solutions",
    async (req) => listSolutions(req.params.projectId),
  );

  app.get<{ Params: { id: string } }>(
    "/api/solutions/:id",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      const health = getHealth(req.params.id);
      return { ...sol, health };
    },
  );

  app.post<{ Body: { problem: string; name: string; projectId?: string } }>(
    "/api/solutions/build",
    async (req, reply) => {
      const { problem, name, projectId } = req.body;
      if (!problem || !name) {
        return reply.code(400).send({ error: "problem and name are required" });
      }

      const result = await buildSolution({ problem, name, projectId });
      const dir = solutionDir(
        { name: result.name, project_id: projectId ?? null }, root,
      );

      fs.mkdirSync(dir, { recursive: true });
      for (const f of result.files) {
        const dest = path.join(dir, f.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, f.content, "utf8");
      }

      createSolution({
        id: result.id,
        name: result.name,
        problem: result.problem,
        projectId: projectId ?? null,
        components: result.components,
        status: "building",
      });

      try {
        await activateSolution(result.id, dir, result.components, cmdCenterDir);
        updateStatus(result.id, "active");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStatus(result.id, "error");
        return { ...getSolution(result.id), startError: msg };
      }

      return getSolution(result.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/solutions/:id/stop",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      await deactivateSolution(req.params.id);
      updateStatus(req.params.id, "stopped");
      return getSolution(req.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/solutions/:id/start",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      const dir = solutionDir(sol, root);
      try {
        await activateSolution(req.params.id, dir, sol.components, cmdCenterDir);
        updateStatus(req.params.id, "active");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStatus(req.params.id, "error");
        return reply.code(500).send({ error: "Failed to start", detail: msg });
      }
      return getSolution(req.params.id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/solutions/:id",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      await deactivateSolution(req.params.id);
      deleteSolution(req.params.id);
      return { ok: true };
    },
  );

  // ── Serve the solution's view as a standalone HTML app ──────────────

  // Compile the solution view and return the JS bundle
  async function compileSolutionView(solutionId: string, solutionDir: string): Promise<string> {
    const viewFile = path.join(solutionDir, "views", "SolutionView.tsx");
    const stat = fs.statSync(viewFile);
    const cached = viewCache.get(solutionId);
    if (cached && cached.mtime === stat.mtimeMs) return cached.js;

    const nodeModules = path.resolve(root, "tools", "command-center", "node_modules");

    // Create a wrapper entry that imports the view and mounts it
    const wrapper = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from ${JSON.stringify(viewFile)};
createRoot(document.getElementById("root")).render(React.createElement(App));
`;
    const result = await esbuild.build({
      stdin: { contents: wrapper, resolveDir: solutionDir, loader: "tsx" },
      bundle: true,
      write: false,
      format: "iife",
      jsx: "automatic",
      target: "es2020",
      nodePaths: [nodeModules],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });

    const js = result.outputFiles?.[0]?.text ?? "";
    viewCache.set(solutionId, { js, mtime: stat.mtimeMs });
    return js;
  }

  app.get<{ Params: { id: string } }>(
    "/api/solutions/:id/app",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });

      const dir = solutionDir(sol, root);
      const viewFile = path.join(dir, "views", "SolutionView.tsx");
      if (!fs.existsSync(viewFile)) {
        return reply.code(404).send({ error: "This solution has no UI view" });
      }

      const apiBase = `/api/solutions/${req.params.id}/proxy`;
      const bundleUrl = `/api/solutions/${req.params.id}/app/bundle.js`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${sol.name}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Rewrite fetch calls from hardcoded localhost:3000 to the proxy
    (function() {
      var _fetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string' && input.match(/^https?:\\/\\/localhost:\\d+/)) {
          input = input.replace(/^https?:\\/\\/localhost:\\d+/, '${apiBase}');
        }
        return _fetch.call(this, input, init);
      };
    })();
  </script>
  <script src="${bundleUrl}"></script>
</body>
</html>`;

      return reply.type("text/html").send(html);
    },
  );

  // Serve the compiled JS bundle separately
  app.get<{ Params: { id: string } }>(
    "/api/solutions/:id/app/bundle.js",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });

      const dir = solutionDir(sol, root);
      const viewFile = path.join(dir, "views", "SolutionView.tsx");
      if (!fs.existsSync(viewFile)) {
        return reply.code(404).send({ error: "No view file" });
      }

      try {
        const js = await compileSolutionView(req.params.id, dir);
        return reply.type("application/javascript").send(js);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: "Failed to compile view", detail: msg });
      }
    },
  );

  // ── Transparency endpoints ──────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/api/solutions/:id/logs",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      return getHealth(req.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/solutions/:id/files",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      const dir = solutionDir(sol, root);
      if (!fs.existsSync(dir)) return { files: [] };
      const files: string[] = [];
      const walk = (d: string, prefix: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.name === "node_modules") continue;
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(path.join(d, entry.name), rel);
          else files.push(rel);
        }
      };
      walk(dir, "");
      return { files };
    },
  );

  app.get<{ Params: { id: string; "*": string } }>(
    "/api/solutions/:id/files/*",
    async (req, reply) => {
      const sol = getSolution(req.params.id);
      if (!sol) return reply.code(404).send({ error: "Solution not found" });
      const dir = solutionDir(sol, root);
      const rel = req.params["*"] ?? "";
      const abs = path.resolve(dir, rel);
      if (!abs.startsWith(dir)) {
        return reply.code(403).send({ error: "Path traversal denied" });
      }
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        return reply.code(404).send({ error: "File not found" });
      }
      return reply.type("text/plain").send(fs.readFileSync(abs, "utf8"));
    },
  );

  // ── Proxy requests to the solution's running service ────────────────
  app.all<{ Params: { id: string; "*": string } }>(
    "/api/solutions/:id/proxy/*",
    async (req, reply) => {
      const port = getServicePort(req.params.id);
      if (!port) {
        return reply.code(503).send({ error: "Solution service is not running" });
      }

      const subPath = req.params["*"] ?? "";
      const target = `http://127.0.0.1:${port}/${subPath}`;

      try {
        const headers: Record<string, string> = {};
        if (req.headers["content-type"]) {
          headers["content-type"] = req.headers["content-type"] as string;
        }

        const proxyRes = await fetch(target, {
          method: req.method,
          headers,
          body: req.method !== "GET" && req.method !== "HEAD"
            ? JSON.stringify(req.body)
            : undefined,
        });

        const contentType = proxyRes.headers.get("content-type") ?? "application/json";
        const body = await proxyRes.text();
        return reply.code(proxyRes.status).type(contentType).send(body);
      } catch (err) {
        return reply.code(502).send({ error: "Failed to reach solution service" });
      }
    },
  );
}
