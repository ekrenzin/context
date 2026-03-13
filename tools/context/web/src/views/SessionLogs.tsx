import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { api, type SessionLogMeta } from "../lib/api";
import { createTerminalTheme } from "../lib/xterm-theme";
import { PageLayout } from "../components/PageLayout";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForCommand(cmd?: string): string {
  if (!cmd) return "Shell";
  const base = cmd.split("/").pop() ?? cmd;
  const labels: Record<string, string> = { claude: "Claude Code", codex: "Codex" };
  return labels[base] ?? base;
}

// ── Session table ─────────────────────────────────────────────────────

function SessionTable({
  sessions,
  onSelect,
  onDelete,
}: {
  sessions: SessionLogMeta[];
  onSelect: (s: SessionLogMeta) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Command</TableCell>
            <TableCell>Directory</TableCell>
            <TableCell>Started</TableCell>
            <TableCell align="right">Size</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.map((s) => (
            <TableRow
              key={s.id}
              hover
              onClick={() => onSelect(s)}
              sx={{ cursor: "pointer" }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {labelForCommand(s.command)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                  {s.cwd ?? "--"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {formatTime(s.startedAt)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="text.secondary">
                  {formatSize(s.sizeBytes)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                {s.exitCode !== undefined ? (
                  <Chip
                    label={`exit ${s.exitCode}`}
                    size="small"
                    color={s.exitCode === 0 ? "success" : "error"}
                  />
                ) : (
                  <Chip label="running" size="small" color="info" variant="outlined" />
                )}
              </TableCell>
              <TableCell align="right" sx={{ py: 0 }}>
                <Tooltip title="Delete log">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Detail view — xterm.js replay ───────────────────────────────────

function SessionDetail({
  session,
  onBack,
}: {
  session: SessionLogMeta;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      theme: createTerminalTheme(theme),
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      cursorBlink: false,
      disableStdin: true,
      scrollback: 10000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();
    termRef.current = term;

    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(el);

    setLoading(true);
    api
      .getSessionLog(session.id)
      .then((res) => {
        for (const entry of res.entries) {
          if (entry.type === "output" && entry.data) {
            term.write(entry.data);
          } else if (entry.type === "exited") {
            term.write(
              `\r\n\x1b[90m[process exited with code ${entry.exitCode ?? "?"}]\x1b[0m\r\n`,
            );
          }
        }
        term.scrollToTop();
      })
      .catch(() => {
        term.write("\x1b[31m[failed to load session log]\x1b[0m\r\n");
      })
      .finally(() => setLoading(false));

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [session.id, theme]);

  return (
    <PageLayout
      title={labelForCommand(session.command)}
      icon={<IconButton onClick={onBack}><ArrowBackIcon /></IconButton>}
      badge={
        <>
          <Chip label={formatTime(session.startedAt)} size="small" variant="outlined" />
          {session.exitCode !== undefined && (
            <Chip label={`exit ${session.exitCode}`} size="small" color={session.exitCode === 0 ? "success" : "error"} />
          )}
        </>
      }
    >
      {session.cwd && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6 }}>
          {session.cwd}
        </Typography>
      )}

      {loading && <Skeleton variant="rounded" height={400} />}
      <Box
        ref={containerRef}
        sx={{
          display: loading ? "none" : "block",
          height: "calc(100vh - 240px)",
          borderRadius: 1,
          overflow: "hidden",
          border: 1,
          borderColor: "divider",
          "& .xterm": { height: "100%", p: 0.5 },
        }}
      />
    </PageLayout>
  );
}

// ── Main view ─────────────────────────────────────────────────────────

export default function SessionLogs() {
  const [sessions, setSessions] = useState<SessionLogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionLogMeta | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSessionLogs()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    await api.deleteSessionLog(id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  if (selected) {
    return (
      <SessionDetail
        session={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      badge={<Chip label={`${sessions.length} sessions`} size="small" variant="outlined" />}
      actions={
        sessions.length > 0 ? <Button size="small" onClick={load}>Refresh</Button> : undefined
      }
    >
      {sessions.length === 0 ? (
        <Alert severity="info">
          No session logs yet. Terminal output will appear here once you run an agent.
        </Alert>
      ) : (
        <SessionTable
          sessions={sessions}
          onSelect={setSelected}
          onDelete={handleDelete}
        />
      )}
    </PageLayout>
  );
}
