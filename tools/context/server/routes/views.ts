import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import { complete } from "../ai/client.js";
import { viewGeneratePrompt, viewModifyPrompt, VIEW_SYSTEM } from "../ai/prompts.js";

const WEB_SRC = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
  "web",
  "src",
);
const VIEWS_DIR = path.join(WEB_SRC, "views");
const REGISTRY_PATH = path.join(VIEWS_DIR, "registry.ts");

interface ViewMeta {
  name: string;
  path: string;
  label: string;
  icon: string;
}

function listViews(): ViewMeta[] {
  const content = fs.readFileSync(REGISTRY_PATH, "utf8");
  const results: ViewMeta[] = [];
  const entryRe = /{\s*path:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*icon:\s*"([^"]+)",\s*component:\s*lazy\(\(\)\s*=>\s*import\("\.\/(\w+)"\)\)/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(content)) !== null) {
    results.push({ path: m[1], label: m[2], icon: m[3], name: m[4] });
  }
  return results;
}

function addToRegistry(name: string, routePath: string, label: string, icon: string): void {
  let content = fs.readFileSync(REGISTRY_PATH, "utf8");

  const newEntry = `  {
    path: "${routePath}",
    label: "${label}",
    icon: "${icon}",
    component: lazy(() => import("./${name}")),
  },`;

  const closingBracket = content.lastIndexOf("];");
  if (closingBracket === -1) throw new Error("Cannot find closing bracket in registry");

  content =
    content.slice(0, closingBracket) +
    newEntry +
    "\n" +
    content.slice(closingBracket);

  fs.writeFileSync(REGISTRY_PATH, content, "utf8");
}

function readSeedView(): string {
  const insightsPath = path.join(VIEWS_DIR, "Insights.tsx");
  if (fs.existsSync(insightsPath)) {
    return fs.readFileSync(insightsPath, "utf8");
  }
  return "";
}

function extractCode(text: string): string {
  const fenced = text.match(/```(?:tsx?|typescript|react)?\s*\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function registerViewRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/views", async () => {
    return listViews();
  });

  app.get<{ Params: { name: string } }>(
    "/api/views/:name/source",
    async (req) => {
      const viewPath = path.join(VIEWS_DIR, `${req.params.name}.tsx`);
      if (!fs.existsSync(viewPath)) {
        return { source: null };
      }
      return { source: fs.readFileSync(viewPath, "utf8") };
    },
  );

  app.post<{ Body: { name: string; description: string } }>(
    "/api/views/generate",
    async (req) => {
      const { description } = req.body;
      let { name } = req.body;
      name = toPascalCase(name);

      const existing = listViews();
      if (existing.some((v) => v.name === name)) {
        throw new Error(`View "${name}" already exists`);
      }

      const seed = readSeedView();
      const prompt = viewGeneratePrompt(name, description, seed);

      const result = await complete({
        system: VIEW_SYSTEM,
        prompt,
        maxTokens: 8192,
        temperature: 0,
      });

      const code = extractCode(result.text);
      const viewPath = path.join(VIEWS_DIR, `${name}.tsx`);
      fs.writeFileSync(viewPath, code, "utf8");

      const routePath = `/${name.replace(/([A-Z])/g, (_, c, i) => (i ? "-" : "") + c.toLowerCase())}`;
      const label = name.replace(/([A-Z])/g, " $1").trim();
      const icon = "Extension";

      addToRegistry(name, routePath, label, icon);

      return { name, path: routePath, label, icon };
    },
  );

  app.post<{ Body: { name: string; instruction: string } }>(
    "/api/views/modify",
    async (req) => {
      const { name, instruction } = req.body;
      const viewPath = path.join(VIEWS_DIR, `${name}.tsx`);

      if (!fs.existsSync(viewPath)) {
        throw new Error(`View "${name}" not found`);
      }

      const currentSource = fs.readFileSync(viewPath, "utf8");
      const prompt = viewModifyPrompt(name, currentSource, instruction);

      const result = await complete({
        system: VIEW_SYSTEM,
        prompt,
        maxTokens: 8192,
        temperature: 0,
      });

      const code = extractCode(result.text);
      fs.writeFileSync(viewPath, code, "utf8");

      return { ok: true };
    },
  );
}
