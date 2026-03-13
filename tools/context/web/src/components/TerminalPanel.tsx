import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { createTerminalTheme } from "../lib/xterm-theme";

interface Props {
  sessionId: string;
  active?: boolean;
  suspendResize?: boolean;
  onExit?: (code: number) => void;
}

export function TerminalPanel({ sessionId, active = true, suspendResize, onExit }: Props) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const suspendResizeRef = useRef(suspendResize);
  suspendResizeRef.current = suspendResize;
  const [dragOver, setDragOver] = useState(false);
  const dragCountRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      theme: createTerminalTheme(theme),
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    fitRef.current = fit;
    termRef.current = term;

    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(el);
    fit.fit();
    term.focus();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => fit.fit();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          term.write(msg.data);
        } else if (msg.type === "exit") {
          term.write(`\r\n\x1b[90m[process exited with code ${msg.code}]\x1b[0m\r\n`);
          onExitRef.current?.(msg.code);
        } else if (msg.type === "error") {
          term.write(`\r\n\x1b[31m[${msg.message}]\x1b[0m\r\n`);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const sendResize = () => {
      if (suspendResizeRef.current) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      }, 120);
    };

    const observer = new ResizeObserver(sendResize);
    observer.observe(el);

    // File drag-and-drop: attach to the container so the overlay (which
    // appears on top of xterm's canvas) can also receive events.
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      dragCountRef.current++;
      if (dragCountRef.current === 1) setDragOver(true);
    };

    const onDragLeave = () => {
      dragCountRef.current--;
      if (dragCountRef.current === 0) setDragOver(false);
    };

    const escapePath = (p: string) =>
      /[^A-Za-z0-9_./:@-]/.test(p) ? `'${p.replace(/'/g, "'\\''")}'` : p;

    const sendPaths = (paths: string[]) => {
      ws.send(JSON.stringify({ type: "input", data: paths.map(escapePath).join(" ") }));
      term.focus();
    };

    const uploadFile = (file: File): Promise<string | null> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1] ?? "";
          fetch("/api/fs/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, data: b64 }),
          })
            .then((r) => {
              if (!r.ok) {
                console.warn(`[drop] upload failed: ${r.status} ${r.statusText}`);
                return null;
              }
              return r.json();
            })
            .then((j: { path: string } | null) => resolve(j?.path ?? null))
            .catch((err) => {
              console.warn("[drop] upload error:", err);
              resolve(null);
            });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setDragOver(false);
      if (!e.dataTransfer || ws.readyState !== WebSocket.OPEN) return;

      const ctx = (window as unknown as { ctx?: { getPathForFile?: (f: File) => string } }).ctx;
      const resolved: string[] = [];
      const unresolved: File[] = [];
      for (const file of Array.from(e.dataTransfer.files)) {
        const filePath =
          ctx?.getPathForFile?.(file) ??
          (file as File & { path?: string }).path;
        if (filePath) resolved.push(filePath);
        else unresolved.push(file);
      }

      if (unresolved.length === 0) {
        sendPaths(resolved);
        return;
      }

      // Upload files that the browser can't resolve paths for
      term.write("\r\n\x1b[90m[uploading dropped file(s)...]\x1b[0m");
      Promise.all(unresolved.map(uploadFile)).then((uploaded) => {
        const all = [...resolved, ...uploaded.filter(Boolean) as string[]];
        if (all.length === 0) {
          const names = unresolved.map((f) => f.name);
          term.write(`\r\n\x1b[33m[drop: upload failed for: ${names.join(", ")}]\x1b[0m\r\n`);
          return;
        }
        term.write("\r\n");
        sendPaths(all);
      });
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, theme]);

  // Fit terminal once when drawer drag ends
  useEffect(() => {
    if (suspendResize === false && fitRef.current && wsRef.current) {
      const fit = fitRef.current;
      const ws = wsRef.current;
      const term = termRef.current;
      fit.fit();
      if (term && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    }
  }, [suspendResize]);

  useEffect(() => {
    if (active && termRef.current) {
      termRef.current.focus();
    }
  }, [active]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          "& .xterm": { height: "100%", p: 0.5 },
        }}
      />
      {dragOver && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: 1,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Box
            component="span"
            sx={{
              color: "primary.main",
              fontSize: 14,
              fontFamily: "monospace",
              fontWeight: 600,
              px: 2,
              py: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: 1,
            }}
          >
            Drop to paste path
          </Box>
        </Box>
      )}
    </Box>
  );
}
