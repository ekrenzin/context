import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sessionId: string;
  active?: boolean;
  onExit?: (code: number) => void;
}

export function TerminalPanel({ sessionId, active = true, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const [dragOver, setDragOver] = useState(false);
  const dragCountRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#585b70",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#f5c2e7",
        cyan: "#94e2d5",
        white: "#bac2de",
      },
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

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setDragOver(false);
      if (!e.dataTransfer || ws.readyState !== WebSocket.OPEN) return;

      const ctx = (window as unknown as { ctx?: { getPathForFile?: (f: File) => string } }).ctx;
      const paths: string[] = [];
      for (const file of Array.from(e.dataTransfer.files)) {
        // Prefer preload bridge; fall back to legacy file.path
        const filePath =
          ctx?.getPathForFile?.(file) ??
          (file as File & { path?: string }).path;
        if (filePath) paths.push(filePath);
      }
      if (paths.length === 0) {
        // Debug: show what we got so user can report the issue
        const names = Array.from(e.dataTransfer.files).map((f) => f.name);
        term.write(`\r\n\x1b[33m[drop: could not resolve path for: ${names.join(", ")}]\x1b[0m\r\n`);
        return;
      }

      const escaped = paths.map((p) =>
        /[^A-Za-z0-9_./:@-]/.test(p) ? `'${p.replace(/'/g, "'\\''")}'` : p,
      );
      ws.send(JSON.stringify({ type: "input", data: escaped.join(" ") }));
      term.focus();
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
  }, [sessionId]);

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
            bgcolor: "rgba(137, 180, 250, 0.12)",
            border: "2px dashed",
            borderColor: "#89b4fa",
            borderRadius: 1,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Box
            component="span"
            sx={{
              color: "#89b4fa",
              fontSize: 14,
              fontFamily: "monospace",
              fontWeight: 600,
              px: 2,
              py: 1,
              bgcolor: "rgba(30, 30, 46, 0.85)",
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
