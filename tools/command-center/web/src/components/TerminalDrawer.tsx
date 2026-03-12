import { useState, useCallback, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import {
  Drawer,
  Box,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Chip,
  Stack,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import { TerminalPanel } from "./TerminalPanel";
import { api } from "../lib/api";

interface TerminalTab {
  id: string;
  label: string;
  command: string;
  exitCode?: number;
}

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
}

export const TerminalDrawer = forwardRef<TerminalDrawerHandle, Props>(function TerminalDrawer({ open, onClose }, ref) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const attachedSessions = useRef(new Set<string>());
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const maxW = window.innerWidth * MAX_WIDTH_RATIO;
      const w = Math.min(maxW, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      setDrawerWidth(w);
    };
    const onUp = () => {
      dragging.current = false;
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
        return [...prev, { id: sessionId, label, command: label }];
      });
    },
  }));

  const handleSpawn = useCallback(async (command: string, args: string[], label: string) => {
    setMenuAnchor(null);
    const result = await api.spawnTerminal(command, args);
    const tab: TerminalTab = { id: result.id, label, command };
    setTabs((prev) => {
      setActiveTab(prev.length);
      return [...prev, tab];
    });
    // Poll once after 3s to pick up async-generated label
    setTimeout(() => {
      api.getTerminal(result.id).then((info) => {
        if (info.label) {
          setTabs((prev) =>
            prev.map((t) => (t.id === result.id ? { ...t, label: info.label! } : t)),
          );
        }
      }).catch(() => {});
    }, 3000);
  }, []);

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

  /** Allow external code (e.g. LaunchButtons) to attach a session */
  // Exposed via ref if needed in the future

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderLeft: 0,
          borderColor: "divider",
          top: 64,
          height: "calc(100vh - 64px)",
          overflow: "visible",
        },
      }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleDragStart}
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: "col-resize",
          zIndex: 10,
          "&:hover, &:active": { bgcolor: "primary.main", opacity: 0.5 },
          transition: "background-color 0.15s",
        }}
      />
      {tabs.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 2,
            px: 3,
          }}
        >
          <TerminalIcon sx={{ fontSize: 48, color: "text.secondary" }} />
          <Typography variant="h6" fontWeight={600}>
            Terminal
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", fontSize: 14 }}
          >
            Run Claude Code, Codex, or a shell alongside any view.
          </Typography>
          <Stack direction="column" spacing={1} sx={{ width: "100%" }}>
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outlined"
                startIcon={p.icon}
                onClick={() => handleSpawn(p.command, p.args, p.label)}
                fullWidth
              >
                {p.label}
              </Button>
            ))}
          </Stack>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Tab bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              borderBottom: 1,
              borderColor: "divider",
              minHeight: 42,
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flex: 1, minHeight: 42, "& .MuiTab-root": { minHeight: 42, py: 0 } }}
            >
              {tabs.map((tab, i) => (
                <Tab
                  key={tab.id}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <span>{tab.label}</span>
                      {tab.exitCode !== undefined && (
                        <Chip
                          size="small"
                          label={`exit ${tab.exitCode}`}
                          color={tab.exitCode === 0 ? "success" : "error"}
                          sx={{ height: 18, fontSize: 11 }}
                        />
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClose(i);
                        }}
                        sx={{ ml: 0.5, p: 0.25 }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  }
                />
              ))}
            </Tabs>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ mr: 0.5 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={!!menuAnchor}
              onClose={() => setMenuAnchor(null)}
            >
              {PRESETS.map((p) => (
                <MenuItem
                  key={p.label}
                  onClick={() => handleSpawn(p.command, p.args, p.label)}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    {p.icon}
                    <span>{p.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Terminal panels */}
          <Box sx={{ flex: 1, position: "relative" }}>
            {tabs.map((tab, i) => (
              <Box
                key={tab.id}
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: i === activeTab ? "block" : "none",
                }}
              >
                <TerminalPanel
                  sessionId={tab.id}
                  active={open && i === activeTab}
                  onExit={(code) => handleExit(i, code)}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Drawer>
  );
});
