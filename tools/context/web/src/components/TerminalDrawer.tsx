import { useState, useCallback, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { Box } from "@mui/material";
import TerminalIcon from "@mui/icons-material/Terminal";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import { api } from "../lib/api";
import { useDefaultCwd } from "../lib/use-default-cwd";
import { randomWord } from "../lib/random-word";
import { TerminalDrawerContent, type TerminalTab } from "./TerminalDrawerContent";

const PRESETS = [
  { label: "Claude Code", command: "claude", args: ["--dangerously-skip-permissions"], icon: <SmartToyIcon /> },
  { label: "Codex", command: "codex", args: ["--full-auto"], icon: <CodeIcon /> },
  { label: "Shell", command: "", args: [] as string[], icon: <TerminalIcon /> },
];

function defaultShell(): string {
  return navigator.platform?.toLowerCase().includes("win") ? "powershell.exe" : "/bin/zsh";
}

/** Map a raw command string to a friendly tab label. */
function labelForCommand(cmd: string): string {
  if (!cmd || cmd === defaultShell() || cmd.endsWith("/zsh") || cmd.endsWith("/bash")) return "Shell";
  const base = cmd.split("/").pop() ?? cmd;
  const labels: Record<string, string> = { claude: "Claude Code", codex: "Codex" };
  return labels[base] ?? base;
}

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 360;
const MAX_WIDTH_RATIO = 0.85;

export interface TerminalDrawerHandle {
  attachSession: (sessionId: string, label: string) => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  highlight?: boolean;
}

export const TerminalDrawer = forwardRef<TerminalDrawerHandle, Props>(function TerminalDrawer({ open, onClose, highlight }, ref) {
  const [glowing, setGlowing] = useState(false);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);

  useEffect(() => {
    if (!highlight || !open) return;
    setGlowing(true);
    const timer = setTimeout(() => setGlowing(false), 3000);
    return () => clearTimeout(timer);
  }, [highlight, open]);
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const attachedSessions = useRef(new Set<string>());
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const defaultCwd = useDefaultCwd();

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const maxW = window.innerWidth * MAX_WIDTH_RATIO;
      const w = Math.min(maxW, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      setDrawerWidth(w);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Restore sessions from the server on mount
  useEffect(() => {
    let cancelled = false;
    api.listTerminals().then((sessions) => {
      if (cancelled || sessions.length === 0) return;
      const restored: TerminalTab[] = sessions
        .filter((s) => s.exitCode === undefined)
        .map((s) => ({
          id: s.id,
          label: s.label ?? labelForCommand(s.command),
          command: s.command,
          nickname: randomWord(),
          exitCode: s.exitCode,
        }));
      if (restored.length === 0) return;
      setTabs(restored);
      for (const t of restored) attachedSessions.current.add(t.id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    attachSession(sessionId: string, label: string) {
      if (attachedSessions.current.has(sessionId)) return;
      attachedSessions.current.add(sessionId);
      setTabs((prev) => {
        const existing = prev.findIndex((t) => t.id === sessionId);
        if (existing >= 0) {
          setActiveTab(existing);
          return prev;
        }
        setActiveTab(prev.length);
        return [...prev, { id: sessionId, label, command: label, nickname: randomWord() }];
      });
    },
  }));

  // Poll for label updates from the local-ai service
  useEffect(() => {
    if (tabs.length === 0) return;
    const interval = setInterval(() => {
      for (const tab of tabs) {
        if (tab.exitCode !== undefined) continue;
        api.getTerminal(tab.id).then((info) => {
          if (info.label && info.label !== tab.label) {
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, label: info.label! } : t)),
            );
          }
        }).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [tabs]);

  const handleSpawn = useCallback(async (command: string, args: string[], label: string) => {
    setMenuAnchor(null);
    const result = await api.spawnTerminal(command, args, defaultCwd);
    const tab: TerminalTab = { id: result.id, label, command, nickname: randomWord() };
    setTabs((prev) => {
      setActiveTab(prev.length);
      return [...prev, tab];
    });
    // Poll once after 3s to pick up initial async-generated label
    setTimeout(() => {
      api.getTerminal(result.id).then((info) => {
        if (info.label) {
          setTabs((prev) =>
            prev.map((t) => (t.id === result.id ? { ...t, label: info.label! } : t)),
          );
        }
      }).catch(() => {});
    }, 3000);
  }, [defaultCwd]);

  const handleClose = useCallback(
    async (index: number) => {
      const tab = tabs[index];
      if (tab) api.killTerminal(tab.id).catch(() => {});
      setTabs((prev) => prev.filter((_, i) => i !== index));
      setActiveTab((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
    },
    [tabs],
  );

  const handleExit = useCallback((index: number, code: number) => {
    setTabs((prev) =>
      prev.map((t, i) => (i === index ? { ...t, exitCode: code } : t)),
    );
  }, []);

  return (
    <Box
      sx={{
        position: "relative",
        flexShrink: 0,
        width: open ? drawerWidth : 0,
        minWidth: open ? MIN_WIDTH : 0,
        maxWidth: open ? `${MAX_WIDTH_RATIO * 100}vw` : 0,
        pt: 8,
        overflow: "hidden",
        borderLeft: open ? (glowing ? 3 : 1) : 0,
        borderColor: glowing ? "primary.main" : "divider",
        bgcolor: "background.paper",
        boxShadow: glowing ? 6 : "none",
        transition: dragging
          ? "none"
          : (theme) =>
              theme.transitions.create(["width", "min-width", "border-color"], {
                duration: theme.transitions.duration.shorter,
                easing: theme.transitions.easing.easeInOut,
              }),
      }}
    >
      {open && (
        <Box
          onMouseDown={handleDragStart}
          sx={{
            position: "absolute",
            left: 0,
            top: 64,
            bottom: 0,
            width: 5,
            cursor: "col-resize",
            zIndex: 10,
            "&:hover, &:active": { bgcolor: "primary.main", opacity: 0.5 },
            transition: "background-color 0.15s",
          }}
        />
      )}
      <Box sx={{ width: drawerWidth, minWidth: drawerWidth, height: "calc(100vh - 64px)" }}>
        {open ? (
          <TerminalDrawerContent
            activeTab={activeTab}
            drawerDragging={dragging}
            menuAnchor={menuAnchor}
            open={open}
            presets={PRESETS}
            setActiveTab={setActiveTab}
            setMenuAnchor={setMenuAnchor}
            tabs={tabs}
            onClose={onClose}
            onExit={handleExit}
            onSpawn={handleSpawn}
            onTabClose={handleClose}
          />
        ) : null}
      </Box>
    </Box>
  );
});
