import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Chip,
  Stack,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryIcon from "@mui/icons-material/History";
import { api, type SessionLogMeta, type SessionLogEntry } from "../lib/api";

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

// ── Session card ──────────────────────────────────────────────────────

function SessionCard({
  session,
  onSelect,
  onDelete,
}: {
  session: SessionLogMeta;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onSelect}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {labelForCommand(session.command)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {session.cwd ?? "—"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1, flexShrink: 0 }}>
              {session.exitCode !== undefined ? (
                <Chip
                  label={`exit ${session.exitCode}`}
                  size="small"
                  color={session.exitCode === 0 ? "success" : "error"}
                />
              ) : (
                <Chip label="running" size="small" color="info" variant="outlined" />
              )}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {formatTime(session.startedAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatSize(session.sizeBytes)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
      <Box sx={{ position: "absolute", top: 8, right: 8 }}>
        <Tooltip title="Delete log">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
}

// ── Detail view — rendered terminal output ────────────────────────────

function SessionDetail({
  session,
  onBack,
}: {
  session: SessionLogMeta;
  onBack: () => void;
}) {
  const [entries, setEntries] = useState<SessionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getSessionLog(session.id)
      .then((res) => setEntries(res.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.id]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  // Concatenate all output chunks for display
  const outputText = entries
    .filter((e) => e.type === "output")
    .map((e) => e.data ?? "")
    .join("");

  // Strip ANSI escape codes for clean display
  const cleanOutput = outputText.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)/g,
    "",
  );

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          {labelForCommand(session.command)}
        </Typography>
        <Chip
          label={formatTime(session.startedAt)}
          size="small"
          variant="outlined"
        />
        {session.exitCode !== undefined && (
          <Chip
            label={`exit ${session.exitCode}`}
            size="small"
            color={session.exitCode === 0 ? "success" : "error"}
          />
        )}
      </Stack>

      {session.cwd && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6 }}>
          {session.cwd}
        </Typography>
      )}

      {loading ? (
        <Skeleton variant="rounded" height={400} />
      ) : (
        <Paper
          variant="outlined"
          sx={{
            bgcolor: "grey.900",
            color: "grey.100",
            p: 2,
            borderRadius: 1,
            overflow: "auto",
            maxHeight: "calc(100vh - 240px)",
          }}
        >
          <pre
            ref={outputRef}
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {cleanOutput || "(no output)"}
          </pre>
        </Paper>
      )}
    </Box>
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
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} item xs={12} sm={6} md={4}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Session Logs
        </Typography>
        <Chip label={`${sessions.length}`} size="small" variant="outlined" />
        {sessions.length > 0 && (
          <Button size="small" onClick={load} sx={{ ml: "auto" }}>
            Refresh
          </Button>
        )}
      </Stack>

      {sessions.length === 0 ? (
        <Alert severity="info">
          No session logs yet. Terminal output will appear here once you run an agent.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {sessions.map((s) => (
            <Grid key={s.id} item xs={12} sm={6} md={4}>
              <SessionCard
                session={s}
                onSelect={() => setSelected(s)}
                onDelete={() => handleDelete(s.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
