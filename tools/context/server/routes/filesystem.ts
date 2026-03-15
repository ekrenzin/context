import fs from "fs";
import path from "path";
import os from "os";
import type { FastifyInstance } from "fastify";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const IGNORED_NAMES = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "venv",
  "dist", "build", ".next", ".nuxt", ".cache", "coverage",
  ".DS_Store", "Thumbs.db",
]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".o", ".a",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".mp4", ".wav", ".avi", ".mov",
  ".sqlite", ".db",
]);

const MAX_FILE_SIZE = 512 * 1024; // 512 KB read limit

function listDirectory(dirPath: string): DirEntry[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDir: true,
      }));
  } catch {
    return [];
  }
}

function listProjectDir(dirPath: string): FileEntry[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => !IGNORED_NAMES.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const full = path.join(dirPath, e.name);
        let size = 0;
        try {
          if (!e.isDirectory()) size = fs.statSync(full).size;
        } catch { /* ignore */ }
        return {
          name: e.name,
          path: full,
          isDir: e.isDirectory(),
          size,
        };
      });
  } catch {
    return [];
  }
}

function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function registerFilesystemRoutes(app: FastifyInstance): void {
  app.get("/api/fs/home", async () => {
    return { path: os.homedir() };
  });

  app.get("/api/fs/browse", async (req) => {
    const query = req.query as { path?: string };
    const target = query.path ?? os.homedir();

    if (!fs.existsSync(target)) {
      return { current: target, entries: [], exists: false };
    }

    return {
      current: target,
      parent: path.dirname(target),
      entries: listDirectory(target),
      exists: true,
    };
  });

  // Browse project files (dirs + files, respects ignore list)
  app.get("/api/fs/project-browse", async (req, reply) => {
    const query = req.query as { root: string; path?: string };
    if (!query.root) {
      reply.status(400);
      return { error: "root is required" };
    }
    const root = path.resolve(query.root);
    const target = query.path ? path.resolve(query.path) : root;

    if (!isPathInside(target, root) && target !== root) {
      reply.status(403);
      return { error: "path outside project root" };
    }

    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return { current: target, root, entries: [], exists: false };
    }

    const rel = path.relative(root, target);
    return {
      current: target,
      root,
      relative: rel || ".",
      parent: target === root ? null : path.dirname(target),
      entries: listProjectDir(target),
      exists: true,
    };
  });

  // Create a directory (recursive)
  app.post("/api/fs/mkdir", async (req, reply) => {
    const body = req.body as { path?: string };
    if (!body?.path) {
      reply.status(400);
      return { error: "path is required" };
    }
    const target = path.resolve(body.path);
    try {
      fs.mkdirSync(target, { recursive: true });
      return { path: target, created: true };
    } catch (err: unknown) {
      reply.status(500);
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  });

  // Upload a dropped file (browser can't expose local paths)
  // 20 MB limit to accommodate base64-encoded images
  app.post("/api/fs/upload", { bodyLimit: 20 * 1024 * 1024 }, async (req, reply) => {
    const body = req.body as { name?: string; data?: string; dir?: string };
    if (!body?.name || !body?.data) {
      reply.status(400);
      return { error: "name and data (base64) are required" };
    }
    // Sanitize filename: strip path separators, collapse whitespace
    const safeName = path.basename(body.name).replace(/[/\\]/g, "_");
    if (!safeName) {
      reply.status(400);
      return { error: "invalid filename" };
    }
    const targetDir = body.dir && fs.existsSync(body.dir)
      ? path.resolve(body.dir)
      : os.tmpdir();
    const dest = path.join(targetDir, safeName);
    fs.writeFileSync(dest, Buffer.from(body.data, "base64"));
    return { path: dest };
  });

  // Read a single file's contents
  app.get("/api/fs/read", async (req, reply) => {
    const query = req.query as { path: string; root?: string };
    if (!query.path) {
      reply.status(400);
      return { error: "path is required" };
    }

    const filePath = path.resolve(query.path);

    // If root provided, enforce containment
    if (query.root) {
      const root = path.resolve(query.root);
      if (!isPathInside(filePath, root)) {
        reply.status(403);
        return { error: "path outside project root" };
      }
    }

    if (!fs.existsSync(filePath)) {
      reply.status(404);
      return { error: "file not found" };
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      reply.status(400);
      return { error: "path is a directory" };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTS.has(ext)) {
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        binary: true,
        content: null,
      };
    }

    const truncated = stat.size > MAX_FILE_SIZE;
    const buf = Buffer.alloc(Math.min(stat.size, MAX_FILE_SIZE));
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);

    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      binary: false,
      truncated,
      content: buf.toString("utf-8"),
    };
  });
}
