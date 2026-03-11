import type { FastifyInstance } from "fastify";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  IntelReport,
  IntelReportType,
  IntelRun,
  IntelRunMeta,
  IntelRunPhase,
  IntelRunProgress,
  IntelListResponse,
} from "../types.js";

const LEGACY_PREFIX_MAP: Record<string, IntelReportType> = {
  "product-analysis": "product-analysis",
  "competitor-search": "competitor-search",
  "competitor-deepdive": "competitor-deepdive",
  "industry-leaders": "industry-leaders",
  "news-scan": "news-scan",
  "article-analysis": "article-analysis",
  "competitive-suggestions": "competitive-suggestions",
  "market-analysis": "market-analysis",
};

const PHASE_TYPE_MAP: Record<string, IntelReportType> = {
  "product-analysis": "product-analysis",
  "competitor-search": "competitor-search",
  deepdive: "competitor-deepdive",
  "industry-leaders": "industry-leaders",
  "news-scan": "news-scan",
  article: "article-analysis",
  suggestions: "competitive-suggestions",
  "demo-sales": "demo-sales",
};

function classifyLegacyFile(filename: string): IntelReportType | null {
  for (const [prefix, type] of Object.entries(LEGACY_PREFIX_MAP)) {
    if (filename.startsWith(prefix) && filename.endsWith(".md")) return type;
  }
  return null;
}

function classifyPhaseFile(filename: string): {
  type: IntelReportType;
  order: number;
} | null {
  const match = filename.match(/^(\d{2})-(.+)\.md$/);
  if (!match) return null;

  const order = parseInt(match[1], 10);
  const slug = match[2];

  for (const [key, type] of Object.entries(PHASE_TYPE_MAP)) {
    if (slug.startsWith(key)) return { type, order };
  }
  return { type: "market-analysis", order };
}

const PHASE_LABELS: Record<number, string> = {
  1: "Product Analysis",
  2: "Competitor Search",
  3: "Competitor Deep Dive",
  4: "Industry Leaders",
  5: "News Scan",
  6: "Article Analysis",
  7: "Competitive Suggestions",
  8: "Demo & Sales",
};

const EXPECTED_BY_DEPTH: Record<string, number[]> = {
  quick: [1, 2, 7],
  full: [1, 2, 3, 7],
  deep: [1, 2, 3, 4, 5, 6, 7, 8],
};

function buildProgress(
  meta: IntelRunMeta | null,
  filePhases: IntelRunPhase[],
): IntelRunProgress | undefined {
  if (!meta?.startedAt) return undefined;
  if (meta.completedAt) return undefined;

  const expectedNums = EXPECTED_BY_DEPTH[meta.depth] ?? [1, 2, 3, 7];
  const completedNums = new Set(
    filePhases.map((p) => p.order),
  );
  const completed = expectedNums.filter((n) => completedNums.has(n)).length;

  const nextPhase = expectedNums.find((n) => !completedNums.has(n));
  const currentLabel = nextPhase ? PHASE_LABELS[nextPhase] : undefined;

  const elapsedSec = Math.round(
    (Date.now() - new Date(meta.startedAt).getTime()) / 1000,
  );

  return {
    completedPhases: completed,
    expectedPhases: expectedNums.length,
    currentLabel,
    elapsedSec,
  };
}

function extractTitle(content: string): string {
  const firstLine = content.split("\n").find((l) => l.startsWith("# "));
  return firstLine ? firstLine.replace(/^#\s+/, "").trim() : "Untitled";
}

function extractDate(content: string): string {
  const match = content.match(/_(?:Generated|Scanned)\s+(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

async function loadRunFromDir(
  outputDir: string,
  dirName: string,
): Promise<IntelRun | null> {
  const dirPath = join(outputDir, dirName);

  const parts = dirName.replace(/^intel-/, "").split("-");
  const dateParts = parts.slice(-3);
  const repoParts = parts.slice(0, -3);
  const date = dateParts.join("-");
  const repo = repoParts.join("-") || "unknown";

  let meta: IntelRunMeta | null = null;
  try {
    const raw = await readFile(join(dirPath, "_meta.json"), "utf-8");
    meta = JSON.parse(raw);
  } catch {
    // _meta.json may not exist yet
  }

  let files: string[];
  try {
    files = await readdir(dirPath);
  } catch {
    return null;
  }

  const phases: IntelRunPhase[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (file.startsWith("_") || !file.endsWith(".md")) continue;
    const classified = classifyPhaseFile(file);
    if (!classified) continue;

    try {
      const filePath = join(dirPath, file);
      const [content, info] = await Promise.all([
        readFile(filePath, "utf-8"),
        stat(filePath),
      ]);
      phases.push({
        filename: file,
        type: classified.type,
        title: extractTitle(content),
        sizeBytes: info.size,
        order: classified.order,
      });
      totalBytes += info.size;
    } catch {
      // skip unreadable
    }
  }

  phases.sort((a, b) => a.order - b.order);

  const complete = meta?.completedAt != null;

  return {
    id: dirName,
    dirName,
    repo: meta?.repo ?? repo,
    date: meta?.startedAt?.slice(0, 10) ?? date,
    depth: meta?.depth ?? "unknown",
    focus: meta?.focus,
    complete,
    phases,
    totalBytes,
    progress: complete ? undefined : buildProgress(meta, phases),
  };
}

async function loadLegacyReports(
  outputDir: string,
): Promise<IntelReport[]> {
  let files: string[];
  try {
    files = await readdir(outputDir);
  } catch {
    return [];
  }

  const reports: IntelReport[] = [];
  for (const filename of files) {
    const type = classifyLegacyFile(filename);
    if (!type) continue;

    try {
      const filepath = join(outputDir, filename);
      const info = await stat(filepath);
      if (!info.isFile()) continue;

      const content = await readFile(filepath, "utf-8");
      reports.push({
        filename,
        type,
        title: extractTitle(content),
        date: extractDate(content) || info.mtime.toISOString().slice(0, 10),
        sizeBytes: info.size,
      });
    } catch {
      // skip
    }
  }

  reports.sort((a, b) => b.date.localeCompare(a.date));
  return reports;
}

export function registerIntelRoutes(
  app: FastifyInstance,
  root: string,
): void {
  const outputDir = join(root, "playground", "output");

  app.get<{ Reply: IntelListResponse }>(
    "/api/intel",
    async (_req, reply) => {
      let entries: string[];
      try {
        entries = await readdir(outputDir);
      } catch {
        return reply.send({ runs: [], legacyReports: [] });
      }

      const runDirs = entries.filter((e) => e.startsWith("intel-"));
      const runPromises = runDirs.map((d) => loadRunFromDir(outputDir, d));
      const runResults = await Promise.all(runPromises);
      const runs = runResults
        .filter((r): r is IntelRun => r !== null)
        .sort((a, b) => {
          if (!a.complete && b.complete) return -1;
          if (a.complete && !b.complete) return 1;
          return b.date.localeCompare(a.date);
        });

      const legacyReports = await loadLegacyReports(outputDir);

      return reply.send({ runs, legacyReports });
    },
  );

  app.post<{
    Body: { repo: string; depth: string; focus?: string };
    Reply: { runId: string };
  }>(
    "/api/intel/runs",
    async (req, reply) => {
      const { repo, depth, focus } = req.body ?? {} as Record<string, string>;
      if (!repo || !depth) {
        return reply.code(400).send({ runId: "" });
      }

      const date = new Date().toISOString().slice(0, 10);
      const runId = `intel-${repo}-${date}`;
      const dirPath = join(outputDir, runId);
      await mkdir(dirPath, { recursive: true });

      const meta: IntelRunMeta = {
        repo,
        depth,
        startedAt: new Date().toISOString(),
        phases: [],
        ...(focus && { focus }),
      };
      await writeFile(join(dirPath, "_meta.json"), JSON.stringify(meta, null, 2));

      return reply.send({ runId });
    },
  );

  app.get<{ Params: { runId: string }; Reply: { content: string } }>(
    "/api/intel/runs/:runId",
    async (req, reply) => {
      const { runId } = req.params;
      if (!runId.startsWith("intel-")) {
        return reply.code(400).send({ content: "" });
      }

      const dirPath = join(outputDir, runId);
      let files: string[];
      try {
        files = await readdir(dirPath);
      } catch {
        return reply.code(404).send({ content: "" });
      }

      const mdFiles = files
        .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
        .sort();

      const sections: string[] = [];
      for (const file of mdFiles) {
        try {
          const content = await readFile(join(dirPath, file), "utf-8");
          sections.push(content);
        } catch {
          // skip
        }
      }

      return reply.send({ content: sections.join("\n\n---\n\n") });
    },
  );

  app.get<{
    Params: { runId: string; filename: string };
    Reply: { content: string };
  }>(
    "/api/intel/runs/:runId/:filename",
    async (req, reply) => {
      const { runId, filename } = req.params;
      if (!runId.startsWith("intel-") || !filename.endsWith(".md")) {
        return reply.code(400).send({ content: "" });
      }

      try {
        const content = await readFile(
          join(outputDir, runId, filename),
          "utf-8",
        );
        return reply.send({ content });
      } catch {
        return reply.code(404).send({ content: "" });
      }
    },
  );

  app.get<{ Params: { filename: string }; Reply: { content: string } }>(
    "/api/intel/legacy/:filename",
    async (req, reply) => {
      const { filename } = req.params;
      if (!classifyLegacyFile(filename)) {
        return reply.code(400).send({ content: "" });
      }

      try {
        const content = await readFile(join(outputDir, filename), "utf-8");
        return reply.send({ content });
      } catch {
        return reply.code(404).send({ content: "" });
      }
    },
  );
}
