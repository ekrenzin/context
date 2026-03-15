import { useEffect, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { createTerminalTheme } from "../lib/xterm-theme";

export type SessionState = "running" | "waiting" | "idle";

/** Regex matching OSC escape: \x1b]ctx:state=<state>\x07 */
const OSC_STATE_RE = /\x1b\]ctx:state=(running|waiting|idle)\x07/g;

interface Options {
  sessionId: string;
  active?: boolean;
  suspendResize?: boolean;
  onExit?: (code: number) => void;
  onStateChange?: (state: SessionState) => void;
  onInput?: (sessionId: string, data: string) => void;
}

function escapePath(p: string) {
  return /[^A-Za-z0-9_./:@-]/.test(p) ? `'${p.replace(/'/g, "'\\''")}'` : p;
}

function uploadFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
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
}

export function useTerminal({
  sessionId,
  active = true,
  suspendResize,
  onExit,
  onStateChange,
  onInput,
}: Options) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const suspendResizeRef = useRef(suspendResize);
  suspendResizeRef.current = suspendResize;
  const [dragOver, setDragOver] = useState(false);
  const dragCountRef = useRef(0);
  const [focused, setFocused] = useState(false);

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
    term.loadAddon(new WebLinksAddon((_event, uri) => {
      window.open(uri, "_blank", "noopener");
    }));
    term.open(el);
    fit.fit();
    term.focus();

    const onFocusIn = () => setFocused(true);
    const onFocusOut = () => setFocused(false);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal/${sessionId}`,
    );
    wsRef.current = ws;

    ws.onopen = () => fit.fit();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") {
          let outData = msg.data as string;
          let stateMatch: RegExpExecArray | null;
          while ((stateMatch = OSC_STATE_RE.exec(outData)) !== null) {
            onStateChangeRef.current?.(stateMatch[1] as SessionState);
          }
          OSC_STATE_RE.lastIndex = 0;
          outData = outData.replace(OSC_STATE_RE, "");
          if (outData) term.write(outData);
        } else if (msg.type === "exit") {
          term.write(
            `\r\n\x1b[90m[process exited with code ${msg.code}]\x1b[0m\r\n`,
          );
          onExitRef.current?.(msg.code);
        } else if (msg.type === "error") {
          term.write(`\r\n\x1b[31m[${msg.message}]\x1b[0m\r\n`);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
        onInputRef.current?.(sessionId, data);
      }
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const sendResize = () => {
      if (suspendResizeRef.current) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            }),
          );
        }
      }, 120);
    };

    const observer = new ResizeObserver(sendResize);
    observer.observe(el);

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

    const sendPaths = (paths: string[]) => {
      ws.send(
        JSON.stringify({
          type: "input",
          data: paths.map(escapePath).join(" "),
        }),
      );
      term.focus();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setDragOver(false);
      if (!e.dataTransfer || ws.readyState !== WebSocket.OPEN) return;

      const ctx = (
        window as unknown as {
          ctx?: { getPathForFile?: (f: File) => string };
        }
      ).ctx;
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

      term.write("\r\n\x1b[90m[uploading dropped file(s)...]\x1b[0m");
      Promise.all(unresolved.map(uploadFile)).then((uploaded) => {
        const all = [
          ...resolved,
          ...(uploaded.filter(Boolean) as string[]),
        ];
        if (all.length === 0) {
          const names = unresolved.map((f) => f.name);
          term.write(
            `\r\n\x1b[33m[drop: upload failed for: ${names.join(", ")}]\x1b[0m\r\n`,
          );
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
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
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
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      }
    }
  }, [suspendResize]);

  useEffect(() => {
    if (active && termRef.current) {
      termRef.current.scrollToBottom();
      termRef.current.focus();
    }
  }, [active]);

  return { containerRef, termRef, focused, setFocused, dragOver };
}
