import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { LazyLog, ScrollFollow } from "@melloware/react-logviewer";
import { useMqttBuffer, useMqttConnected } from "../hooks/useMqtt";

interface LogEntry {
  level: number;
  time: number;
  name: string;
  msg: string;
  app?: string;
  [key: string]: unknown;
}

const LEVEL_LABELS: Record<number, string> = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

function levelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? (level >= 50 ? "ERROR" : "INFO");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + `.${String(d.getMilliseconds()).padStart(3, "0")}`
  );
}

function levelAnsi(level: number): string {
  if (level >= 50) return "\x1b[31m";
  if (level >= 40) return "\x1b[33m";
  if (level >= 30) return "\x1b[32m";
  return "\x1b[36m";
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

function extractMessage(entry: LogEntry): string {
  const output = entry.output as string | undefined;
  const req = entry.req as { method?: string; url?: string } | undefined;
  const res = entry.res as { statusCode?: number } | undefined;
  const responseTime = entry.responseTime as number | undefined;
  const reqId = entry.req_id as string | undefined;

  if (entry.msg === "request completed" && req?.method) {
    const status = res?.statusCode ?? "???";
    const rt = responseTime != null ? ` ${responseTime}ms` : "";
    return `${req.method} ${req.url} -> ${status}${rt}`;
  }

  if (output) {
    const prefix = entry.msg && entry.msg !== "console" ? `[${entry.msg}] ` : "";
    const rid = reqId ? ` ${DIM}(${reqId.split("-").slice(-1)[0]})${RESET}` : "";
    return `${prefix}${output}${rid}`;
  }

  if (entry.msg) return entry.msg;
  return JSON.stringify(entry);
}

function formatLogLine(entry: LogEntry): string {
  const time = formatTime(entry.time);
  const lvl = levelLabel(entry.level).padEnd(5);
  const app = (entry.app ?? entry.name ?? "unknown").padEnd(20);
  const color = levelAnsi(entry.level);

  return `${DIM}${time}${RESET} ${color}${lvl}${RESET} ${CYAN}${app}${RESET} ${extractMessage(entry)}`;
}

type LevelFilter = "all" | "debug" | "info" | "warn" | "error";

export function Logs() {
  const connected = useMqttConnected();

  const infoLogs = useMqttBuffer<LogEntry>("ctx/logs/info", 2000);
  const warnLogs = useMqttBuffer<LogEntry>("ctx/logs/warn", 2000);
  const errorLogs = useMqttBuffer<LogEntry>("ctx/logs/error", 2000);
  const debugLogs = useMqttBuffer<LogEntry>("ctx/logs/debug", 2000);

  const allLogs = useMemo(() => {
    return [...debugLogs, ...infoLogs, ...warnLogs, ...errorLogs].sort(
      (a, b) => (a.time ?? 0) - (b.time ?? 0),
    );
  }, [debugLogs, infoLogs, warnLogs, errorLogs]);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<string | null>(null);
  const [clearedAt, setClearedAt] = useState(0);

  const apps = useMemo(() => {
    const names = new Set<string>();
    for (const entry of allLogs) {
      const name = entry.app ?? entry.name;
      if (name) names.add(name);
    }
    return [...names].sort();
  }, [allLogs]);

  const filtered = useMemo(() => {
    let logs = allLogs;

    if (clearedAt) {
      logs = logs.filter((l) => l.time > clearedAt);
    }

    if (levelFilter !== "all") {
      const thresholds: Record<string, number> = {
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
      };
      const threshold = thresholds[levelFilter] ?? 30;
      logs = logs.filter((l) => l.level >= threshold);
    }

    if (appFilter) {
      logs = logs.filter((l) => (l.app ?? l.name) === appFilter);
    }

    if (search) {
      const lower = search.toLowerCase();
      logs = logs.filter((l) => {
        const output = (l.output as string) ?? "";
        const req = l.req as { url?: string } | undefined;
        return (
          l.msg?.toLowerCase().includes(lower) ||
          l.name?.toLowerCase().includes(lower) ||
          output.toLowerCase().includes(lower) ||
          req?.url?.toLowerCase().includes(lower)
        );
      });
    }

    return logs;
  }, [allLogs, levelFilter, search, appFilter, clearedAt]);

  const text = useMemo(() => {
    if (filtered.length === 0) {
      return "Waiting for log entries on ctx/logs/* ...";
    }
    return filtered.map(formatLogLine).join("\n");
  }, [filtered]);

  const handleClear = useCallback(() => {
    setClearedAt(Date.now());
  }, []);

  return (
    <Box
      sx={{
        height: "calc(100vh - 100px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Log Stream
        </Typography>
        <Chip
          size="small"
          label={connected ? "MQTT Connected" : "Disconnected"}
          color={connected ? "success" : "default"}
          variant="outlined"
        />
        <Chip
          size="small"
          label={`${filtered.length} entries`}
          variant="outlined"
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <ToggleButtonGroup
          size="small"
          value={levelFilter}
          exclusive
          onChange={(_, val) => {
            if (val) setLevelFilter(val);
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="debug">Debug</ToggleButton>
          <ToggleButton value="info">Info</ToggleButton>
          <ToggleButton value="warn">Warn</ToggleButton>
          <ToggleButton value="error">Error</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Filter messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {apps.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Chip
              size="small"
              label="All apps"
              variant={appFilter === null ? "filled" : "outlined"}
              onClick={() => setAppFilter(null)}
              color={appFilter === null ? "primary" : "default"}
            />
            {apps.map((app) => (
              <Chip
                key={app}
                size="small"
                label={app}
                variant={appFilter === app ? "filled" : "outlined"}
                onClick={() => setAppFilter(appFilter === app ? null : app)}
                color={appFilter === app ? "primary" : "default"}
              />
            ))}
          </Box>
        )}

        <Box sx={{ ml: "auto" }}>
          <Tooltip title="Clear">
            <IconButton size="small" onClick={handleClear}>
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ScrollFollow
          startFollowing
          render={({ follow, onScroll }) => (
            <LazyLog
              text={text}
              extraLines={1}
              enableSearch
              caseInsensitive
              follow={follow}
              scrollToLine={follow ? filtered.length : undefined}
              onScroll={onScroll}
              enableLineNumbers={false}
              enableHotKeys
              selectableLines
              style={{
                background: "#1a1a2e",
                fontSize: "0.8rem",
              }}
            />
          )}
        />
      </Box>
    </Box>
  );
}
