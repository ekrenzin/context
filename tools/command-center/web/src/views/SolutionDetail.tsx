import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Alert,
  Skeleton,
  Paper,
  Tab,
  Tabs,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteIcon from "@mui/icons-material/Delete";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

interface SolutionComponent {
  type: string;
  [key: string]: unknown;
}

interface SolutionDetail {
  id: string;
  name: string;
  problem: string;
  project_id: string | null;
  status: string;
  components: SolutionComponent[];
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  health?: { running: boolean; logTail: string[] };
}

const STATUS_COLOR: Record<string, "success" | "default" | "warning" | "error"> = {
  active: "success",
  stopped: "default",
  building: "warning",
  error: "error",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${res.status}`);
  return res.json();
}

export default function SolutionDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [solution, setSolution] = useState<SolutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchJson<SolutionDetail>(`/api/solutions/${id}`)
      .then(setSolution)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const running = solution?.status === "active" || solution?.status === "building";
  const healthRunning = solution?.health?.running ?? false;
  const statusMismatch = solution?.status === "active" && !healthRunning;

  const toggle = async () => {
    if (!solution) return;
    setActionLoading(true);
    try {
      await fetchJson(`/api/solutions/${solution.id}/${running ? "stop" : "start"}`, { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const remove = async () => {
    if (!solution) return;
    setActionLoading(true);
    try {
      await fetchJson(`/api/solutions/${solution.id}`, { method: "DELETE" });
      navigate("/solutions");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ pt: 3, maxWidth: 900, mx: "auto" }}>
        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  if (error || !solution) {
    return (
      <Box sx={{ pt: 3, maxWidth: 900, mx: "auto" }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/solutions")} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error ?? "Solution not found"}</Alert>
      </Box>
    );
  }

  const hasView = solution.components.some((c) => c.type === "view");
  const statusColor = STATUS_COLOR[solution.status] ?? "error";

  return (
    <Box sx={{ pt: 2, maxWidth: 900, mx: "auto" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/solutions")} size="small" sx={{ mb: 1 }}>
        Back
      </Button>

      {/* Header bar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h5" fontWeight={700}>{solution.name}</Typography>
          <FiberManualRecordIcon sx={{ fontSize: 10, color: healthRunning ? "success.main" : "text.disabled" }} />
          <Chip label={solution.status} color={statusColor} size="small" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            color={running ? "warning" : "success"}
            startIcon={running ? <StopIcon /> : <PlayArrowIcon />}
            onClick={toggle}
            disabled={actionLoading}
          >
            {running ? "Stop" : "Start"}
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={remove} disabled={actionLoading}>
            Delete
          </Button>
        </Stack>
      </Stack>

      {statusMismatch && (
        <Alert severity="warning" sx={{ mb: 1 }} action={
          <Button size="small" onClick={() => setTab(2)}>View Logs</Button>
        }>
          Status is "active" but the process is not running. Check the Logs tab.
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="View" />
        <Tab label="Code" />
        <Tab label="Logs" />
        <Tab label="Settings" />
      </Tabs>

      {tab === 0 && <ViewTab id={solution.id} hasView={hasView} running={healthRunning} name={solution.name} />}
      {tab === 1 && <CodeTab id={solution.id} />}
      {tab === 2 && <LogsTab id={solution.id} />}
      {tab === 3 && <SettingsTab solution={solution} />}
    </Box>
  );
}

function ViewTab({ id, hasView, running, name }: { id: string; hasView: boolean; running: boolean; name: string }) {
  if (!hasView) {
    return <Alert severity="info">This solution has no UI view component.</Alert>;
  }
  if (!running) {
    return <Alert severity="warning">Service is not running. Start the solution to see its view.</Alert>;
  }
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 1 }}>
      <iframe
        src={`/api/solutions/${id}/app`}
        title={`${name} view`}
        style={{ width: "100%", height: "calc(100vh - 260px)", border: "none", display: "block", minHeight: 400 }}
      />
    </Paper>
  );
}

function CodeTab({ id }: { id: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetch(`/api/solutions/${id}/files`).then((r) => r.json()).then((d) => {
      setFiles(d.files ?? []);
      if (d.files?.length) setSelected(d.files[0]);
    });
  }, [id]);

  useEffect(() => {
    if (!selected) return;
    setLoadingContent(true);
    fetch(`/api/solutions/${id}/files/${selected}`)
      .then((r) => r.text())
      .then(setContent)
      .finally(() => setLoadingContent(false));
  }, [id, selected]);

  return (
    <Stack direction="row" spacing={2} sx={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
      <Paper variant="outlined" sx={{ width: 220, flexShrink: 0, overflow: "auto" }}>
        <List dense disablePadding>
          {files.map((f) => (
            <ListItemButton key={f} selected={f === selected} onClick={() => setSelected(f)}>
              <ListItemText primary={f} primaryTypographyProps={{ variant: "caption", noWrap: true }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Paper
        variant="outlined"
        sx={{
          flex: 1, overflow: "auto", p: 1.5,
          bgcolor: "grey.900", color: "grey.100",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}
      >
        {loadingContent ? "Loading..." : content}
      </Paper>
    </Stack>
  );
}

function LogsTab({ id }: { id: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(() => {
    fetch(`/api/solutions/${id}/logs`)
      .then((r) => r.json())
      .then((d) => {
        setLines(d.logTail ?? []);
        setIsRunning(d.running ?? false);
      });
  }, [id]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Process: {isRunning ? "running" : "not running"} | Auto-refreshes every 3s
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5, height: "calc(100vh - 300px)", minHeight: 300, overflow: "auto",
          bgcolor: "grey.900", color: "grey.100",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
        }}
      >
        {lines.length === 0 && <span style={{ color: "#888" }}>No log output yet.</span>}
        {lines.map((line, i) => <div key={i}>{line}</div>)}
        <div ref={bottomRef} />
      </Paper>
    </Box>
  );
}

function SettingsTab({ solution }: { solution: SolutionDetail }) {
  const COMPONENT_LABELS: Record<string, string> = {
    service: "Backend Service",
    view: "UI View",
    skill: "AI Skill",
    rule: "Editor Rule",
    memory: "Memory Entry",
    mqtt: "Event Bus",
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Problem</Typography>
        <Typography variant="body2" color="text.secondary">{solution.problem}</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Components</Typography>
        <Stack spacing={0.5}>
          {solution.components.map((c, i) => (
            <Typography key={i} variant="body2">
              {COMPONENT_LABELS[c.type] ?? c.type}
            </Typography>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Metadata</Typography>
        <Typography variant="body2">Created: {new Date(solution.created_at).toLocaleString()}</Typography>
        <Typography variant="body2">Updated: {new Date(solution.updated_at).toLocaleString()}</Typography>
        <Typography variant="body2">Used: {solution.usage_count} time{solution.usage_count !== 1 ? "s" : ""}</Typography>
      </Paper>
    </Stack>
  );
}
