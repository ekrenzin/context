import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Typography,
  Chip,
  Stack,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import { TerminalPanel, type SessionState } from "../components/TerminalPanel";
import { api } from "../lib/api";
import { randomWord } from "../lib/random-word";

function commandName(command: string) {
  if (command === "claude") return "Claude";
  if (command === "codex") return "Codex";
  return "Terminal";
}
import { useDefaultCwd } from "../lib/use-default-cwd";

interface TerminalTab {
  id: string;
  label: string;
  command: string;
  nickname: string;
  exitCode?: number;
  state?: SessionState;
}

const STATE_COLORS: Record<SessionState, string> = {
  running: "#4caf50",
  waiting: "#ff9800",
  idle: "#9e9e9e",
};

const PRESETS = [
  { label: "Claude Code", command: "claude", args: ["--dangerously-skip-permissions"], icon: <SmartToyIcon /> },
  { label: "Codex", command: "codex", args: ["--full-auto"], icon: <CodeIcon /> },
  { label: "Shell", command: "", args: [] as string[], icon: <TerminalIcon /> },
];

function EmptyState({ onSpawn }: { onSpawn: (cmd: string, args: string[], label: string) => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 120px)",
        gap: 3,
      }}
    >
      <TerminalIcon sx={{ fontSize: 64, color: "text.secondary" }} />
      <Typography variant="h5" fontWeight={600}>
        Embedded Terminal
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480, textAlign: "center" }}>
        Run Claude Code, Codex, or any CLI tool directly in the Command Center.
        No more switching windows.
      </Typography>
      <Stack direction="row" spacing={2}>
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outlined"
            startIcon={p.icon}
            onClick={() => onSpawn(p.command, p.args, p.label)}
          >
            {p.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

function TabLabel({
  tab,
  onClose,
}: {
  tab: TerminalTab;
  onClose: () => void;
}) {
  return (
    <Tooltip title={tab.label} enterDelay={300}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {tab.state && (
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: STATE_COLORS[tab.state],
            flexShrink: 0,
            transition: "background-color 0.3s ease",
          }}
        />
      )}
      <span>{commandName(tab.command)} {tab.nickname}</span>
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
          onClose();
        }}
        sx={{ ml: 0.5, p: 0.25 }}
      >
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
    </Tooltip>
  );
}

export default function Terminal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const attachedSessions = useRef(new Set<string>());
  const defaultCwd = useDefaultCwd();

  useEffect(() => {
    const sessionId = searchParams.get("session");
    const label = searchParams.get("label") ?? "Session";
    if (!sessionId || attachedSessions.current.has(sessionId)) return;

    attachedSessions.current.add(sessionId);
    setSearchParams({}, { replace: true });

    setTabs((prev) => {
      const existing = prev.findIndex((t) => t.id === sessionId);
      if (existing >= 0) {
        setActiveTab(existing);
        return prev;
      }
      setActiveTab(prev.length);
      return [...prev, { id: sessionId, label, command: label, nickname: randomWord() }];
    });
  }, [searchParams, setSearchParams]);

  // Poll for label updates from the local-ai service
  useEffect(() => {
    if (tabs.length === 0) return;
    const interval = setInterval(() => {
      for (const tab of tabs) {
        if (tab.exitCode !== undefined) continue;
        api.getTerminal(tab.id).then((info) => {
          const updates: Partial<TerminalTab> = {};
          if (info.label && info.label !== tab.label) updates.label = info.label;
          if (info.state && info.state !== tab.state) updates.state = info.state as SessionState;
          if (Object.keys(updates).length > 0) {
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, ...updates } : t)),
            );
          }
        }).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [tabs]);

  const handleSpawn = useCallback(
    async (command: string, args: string[], label: string) => {
      setMenuAnchor(null);
      const result = await api.spawnTerminal(command, args, defaultCwd);
      const tab: TerminalTab = { id: result.id, label: "NEW SESSION", command, nickname: randomWord() };
      setTabs((prev) => {
        setActiveTab(prev.length);
        return [...prev, tab];
      });
    },
    [defaultCwd],
  );

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

  const handleStateChange = useCallback((index: number, state: SessionState) => {
    setTabs((prev) =>
      prev.map((t, i) => (i === index ? { ...t, state } : t)),
    );
  }, []);

  if (tabs.length === 0) {
    return <EmptyState onSpawn={handleSpawn} />;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 88px)" }}>
      <Box sx={{ display: "flex", alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1 }}
        >
          {tabs.map((tab, i) => (
            <Tab
              key={tab.id}
              label={<TabLabel tab={tab} onClose={() => handleClose(i)} />}
            />
          ))}
        </Tabs>
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ mr: 1 }}>
          <AddIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={!!menuAnchor}
          onClose={() => setMenuAnchor(null)}
        >
          {PRESETS.map((p) => (
            <MenuItem key={p.label} onClick={() => handleSpawn(p.command, p.args, p.label)}>
              <Stack direction="row" spacing={1} alignItems="center">
                {p.icon}
                <span>{p.label}</span>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      </Box>

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
              active={i === activeTab}
              onExit={(code) => handleExit(i, code)}
              onStateChange={(state) => handleStateChange(i, state)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
