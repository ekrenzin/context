#!/usr/bin/env node
// Standalone PTY host — spawned detached so it survives server restarts.
// Owns the PTY process and exposes it via a Unix domain socket.
// Multiple clients can connect/disconnect without affecting the PTY.
"use strict";

const pty = require("node-pty");
const net = require("net");
const fs = require("fs");
const path = require("path");

const config = JSON.parse(process.argv[2]);
const { socketPath, command, args, cwd, cols, rows, env } = config;

fs.mkdirSync(path.dirname(socketPath), { recursive: true });
try { fs.unlinkSync(socketPath); } catch {}

const proc = pty.spawn(command, args || [], {
  name: "xterm-256color",
  cols: cols || 120,
  rows: rows || 30,
  cwd: cwd || process.env.HOME || "/",
  env: Object.assign({}, process.env, env || {}),
});

// Ring buffer for recent output so reconnecting clients get context
const SCROLLBACK_LIMIT = 50000;
let scrollback = "";

let exitCode;
const clients = new Set();

proc.onData((data) => {
  scrollback += data;
  if (scrollback.length > SCROLLBACK_LIMIT * 1.5) {
    scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
  }
  for (const c of clients) {
    try { c.write(JSON.stringify({ type: "output", data }) + "\n"); } catch {}
  }
});

proc.onExit(({ exitCode: code }) => {
  exitCode = code;
  for (const c of clients) {
    try { c.write(JSON.stringify({ type: "exit", code }) + "\n"); } catch {}
  }
  // Keep socket alive briefly so clients can read exit, then shut down
  setTimeout(() => { cleanup(); process.exit(0); }, 5000);
});

const server = net.createServer((socket) => {
  clients.add(socket);

  // Send scrollback so reconnecting clients see recent output
  if (scrollback.length > 0) {
    try { socket.write(JSON.stringify({ type: "output", data: scrollback }) + "\n"); } catch {}
  }

  // If already exited, inform immediately
  if (exitCode !== undefined) {
    try { socket.write(JSON.stringify({ type: "exit", code: exitCode }) + "\n"); } catch {}
  }

  let buf = "";
  socket.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "input") proc.write(msg.data);
        else if (msg.type === "resize") proc.resize(msg.cols, msg.rows);
        else if (msg.type === "kill") { try { proc.kill(); } catch {} }
      } catch {}
    }
  });

  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

server.listen(socketPath, () => {
  // Signal parent that the socket is ready
  if (process.send) process.send("READY");
});

function cleanup() {
  try { proc.kill(); } catch {}
  try { server.close(); } catch {}
  try { fs.unlinkSync(socketPath); } catch {}
}

process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });
