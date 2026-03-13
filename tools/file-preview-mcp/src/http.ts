import express from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Server } from "http";
import type { Response } from "express";
import { SUPPORTED_EXTENSIONS, MAX_FILE_SIZE } from "./types.js";
import type { PreviewEntry, FileType } from "./types.js";
import { addEntry, getEntries, subscribe } from "./store.js";

let server: Server | null = null;
let port = parseInt(process.env.PREVIEW_PORT ?? "3456", 10);
const autoOpen = process.env.PREVIEW_AUTO_OPEN !== "false";
let opened = false;

function mimeFor(type: FileType, ext: string): string {
  switch (type) {
    case "image":
      if (ext === ".png") return "image/png";
      if (ext === ".gif") return "image/gif";
      if (ext === ".webp") return "image/webp";
      return "image/jpeg";
    case "svg": return "image/svg+xml";
    case "pdf": return "application/pdf";
    case "html": return "text/html";
    case "csv": return "text/csv";
    case "json": return "application/json";
    case "markdown": return "text/plain";
  }
}

export function resolveFile(filePath: string): {
  ok: true; type: FileType; size: number; filename: string; ext: string;
} | { ok: false; error: string } {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${filePath}` };
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = SUPPORTED_EXTENSIONS[ext];
  if (!type) {
    const supported = Object.keys(SUPPORTED_EXTENSIONS).join(", ");
    return { ok: false, error: `Unsupported extension "${ext}". Supported: ${supported}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    return { ok: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB` };
  }
  return { ok: true, type, size: stat.size, filename: path.basename(filePath), ext };
}

export function createPreviewEntry(
  filePath: string, type: FileType, filename: string, title?: string,
): PreviewEntry {
  const id = randomUUID().slice(0, 8);
  const entry: PreviewEntry = {
    id,
    path: filePath,
    filename,
    type,
    title: title ?? filename,
    url: `http://127.0.0.1:${port}/files/${id}/${encodeURIComponent(filename)}`,
    timestamp: new Date().toISOString(),
  };
  addEntry(entry);
  return entry;
}

function buildApp(): express.Express {
  const app = express();

  // Serve files by id
  app.get("/files/:id/:filename", (req, res) => {
    const entries = getEntries();
    const entry = entries.find((e) => e.id === req.params.id);
    if (!entry) {
      res.status(404).send("Not found");
      return;
    }
    const ext = path.extname(entry.path).toLowerCase();
    res.setHeader("Content-Type", mimeFor(entry.type, ext));
    fs.createReadStream(entry.path).pipe(res);
  });

  // SSE endpoint for live updates
  app.get("/events", (_req, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Send existing entries
    for (const entry of getEntries()) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    const unsub = subscribe((entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    _req.on("close", unsub);
  });

  // Gallery API
  app.get("/api/entries", (_req, res) => {
    res.json(getEntries());
  });

  // Serve the preview UI
  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(buildHtml());
  });

  return app;
}

export async function ensureServer(): Promise<string> {
  if (server) return `http://127.0.0.1:${port}`;

  const app = buildApp();

  return new Promise((resolve, reject) => {
    server = app.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${port}`;
      console.error(`[preview] server listening on ${url}`);
      resolve(url);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        port++;
        server = app.listen(port, "127.0.0.1", () => {
          const url = `http://127.0.0.1:${port}`;
          console.error(`[preview] server listening on ${url} (fallback port)`);
          resolve(url);
        });
      } else {
        reject(err);
      }
    });
  });
}

export async function openBrowser(url: string): Promise<void> {
  if (!autoOpen || opened) return;
  opened = true;
  try {
    const open = (await import("open")).default;
    await open(url);
  } catch {
    console.error(`[preview] could not open browser. Visit: ${url}`);
  }
}

export function stopServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>File Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a2e; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; height: 100vh; }
  #sidebar { width: 220px; background: #16213e; border-right: 1px solid #2a2a4a; overflow-y: auto; flex-shrink: 0; }
  #sidebar h2 { padding: 16px; font-size: 14px; color: #8888aa; text-transform: uppercase; letter-spacing: 1px; }
  .thumb { padding: 8px 16px; cursor: pointer; border-bottom: 1px solid #1a1a3e; display: flex; align-items: center; gap: 8px; }
  .thumb:hover, .thumb.active { background: #1a1a3e; }
  .thumb img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
  .thumb .icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #2a2a4a; border-radius: 4px; font-size: 18px; }
  .thumb .meta { overflow: hidden; }
  .thumb .name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .thumb .time { font-size: 11px; color: #666; }
  #main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
  #main img { max-width: 100%; max-height: 100%; object-fit: contain; }
  #main iframe { width: 100%; height: 100%; border: none; background: #fff; border-radius: 8px; }
  #main pre { background: #16213e; padding: 24px; border-radius: 8px; overflow: auto; max-width: 100%; max-height: 100%; font-size: 13px; white-space: pre-wrap; }
  #main table { border-collapse: collapse; background: #16213e; border-radius: 8px; overflow: hidden; font-size: 13px; }
  #main th, #main td { padding: 8px 12px; border: 1px solid #2a2a4a; text-align: left; }
  #main th { background: #1a1a3e; position: sticky; top: 0; }
  #main object { width: 100%; height: 100%; }
  #empty { color: #555; font-size: 18px; }
</style>
</head>
<body>
<div id="sidebar">
  <h2>Previews</h2>
  <div id="list"></div>
</div>
<div id="main"><span id="empty">Waiting for previews...</span></div>
<script>
const entries = [];
let selected = null;

function iconFor(type) {
  const icons = { image: '🖼', pdf: '📄', html: '🌐', svg: '◇', csv: '📊', json: '{}', markdown: '📝' };
  return icons[type] || '📁';
}

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString();
}

function renderList() {
  const list = document.getElementById('list');
  list.innerHTML = '';
  entries.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'thumb' + (selected === i ? ' active' : '');
    const isImg = e.type === 'image' || e.type === 'svg';
    div.innerHTML = (isImg
      ? '<img src="' + e.url + '" alt="">'
      : '<div class="icon">' + iconFor(e.type) + '</div>')
      + '<div class="meta"><div class="name">' + e.title + '</div><div class="time">' + timeStr(e.timestamp) + '</div></div>';
    div.onclick = () => { selected = i; renderList(); renderMain(); };
    list.appendChild(div);
  });
}

function renderMain() {
  const main = document.getElementById('main');
  if (entries.length === 0) { main.innerHTML = '<span id="empty">Waiting for previews...</span>'; return; }
  const e = entries[selected ?? entries.length - 1];
  switch (e.type) {
    case 'image':
      main.innerHTML = '<img src="' + e.url + '" alt="' + e.title + '">';
      break;
    case 'svg':
      main.innerHTML = '<img src="' + e.url + '" alt="' + e.title + '">';
      break;
    case 'pdf':
      main.innerHTML = '<object data="' + e.url + '" type="application/pdf" width="100%" height="100%"><a href="' + e.url + '">Download PDF</a></object>';
      break;
    case 'html':
      main.innerHTML = '<iframe sandbox="allow-same-origin" src="' + e.url + '"></iframe>';
      break;
    case 'csv':
      fetch(e.url).then(r => r.text()).then(text => {
        const rows = text.split('\\n').map(r => r.split(','));
        let html = '<div style="overflow:auto;max-width:100%;max-height:100%"><table><thead><tr>';
        if (rows.length > 0) rows[0].forEach(h => html += '<th>' + h + '</th>');
        html += '</tr></thead><tbody>';
        rows.slice(1).filter(r => r.length > 1 || r[0]).forEach(r => {
          html += '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>';
        });
        html += '</tbody></table></div>';
        main.innerHTML = html;
      });
      break;
    case 'json':
      fetch(e.url).then(r => r.text()).then(text => {
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch {}
        main.innerHTML = '<pre>' + text.replace(/</g, '&lt;') + '</pre>';
      });
      break;
    case 'markdown':
      fetch(e.url).then(r => r.text()).then(text => {
        main.innerHTML = '<pre>' + text.replace(/</g, '&lt;') + '</pre>';
      });
      break;
  }
}

const evtSource = new EventSource('/events');
evtSource.onmessage = (event) => {
  const entry = JSON.parse(event.data);
  const exists = entries.find(e => e.id === entry.id);
  if (!exists) {
    entries.push(entry);
    if (selected === null || selected === entries.length - 2) selected = entries.length - 1;
    renderList();
    renderMain();
  }
};
</script>
</body>
</html>`;
}
