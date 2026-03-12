import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  Stack,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import EditNoteIcon from "@mui/icons-material/EditNote";
import AirIcon from "@mui/icons-material/Air";
import { api } from "../lib/api";

const IDE_ICONS: Record<string, React.ReactElement> = {
  "claude-code": <SmartToyIcon fontSize="small" />,
  codex: <CodeIcon fontSize="small" />,
  cursor: <EditNoteIcon fontSize="small" />,
  windsurf: <AirIcon fontSize="small" />,
};

interface Solution {
  id: string;
  name: string;
  problem: string;
  project_id: string | null;
  status: string;
  components: Array<{ type: string }>;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SolutionExample {
  problem: string;
  name: string;
  persona: string;
  icon: string;
}

const STATUS_MAP: Record<string, { label: string; color: "success" | "default" | "warning" | "error" }> = {
  active: { label: "Active", color: "success" },
  stopped: { label: "Paused", color: "default" },
  building: { label: "Building", color: "warning" },
  error: { label: "Needs Attention", color: "error" },
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${res.status}`);
  return res.json();
}

function SolutionCard({ sol, onAction }: { sol: Solution; onAction: () => void }) {
  const navigate = useNavigate();
  const status = STATUS_MAP[sol.status] ?? STATUS_MAP.error;
  const running = sol.status === "active" || sol.status === "building";
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchJson(`/api/solutions/${sol.id}/${running ? "stop" : "start"}`, { method: "POST" });
    onAction();
  };
  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchJson(`/api/solutions/${sol.id}`, { method: "DELETE" });
    onAction();
  };

  return (
    <Card
      variant="outlined"
      sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
      onClick={() => navigate(`/solutions/${sol.id}`)}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>{sol.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{sol.problem}</Typography>
          </Box>
          <Chip label={status.label} color={status.color} size="small" sx={{ ml: 1, flexShrink: 0 }} />
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Used {sol.usage_count ?? 0} times</Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="View details">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/solutions/${sol.id}`); }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={running ? "Stop — shuts down the service" : "Start — launches the service"}>
              <IconButton size="small" onClick={toggle}>
                {running ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete — removes this solution permanently">
              <IconButton size="small" color="error" onClick={remove}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreated }: { onCreated: () => void }) {
  const [problem, setProblem] = useState("");
  const [name, setName] = useState("");
  const [examples, setExamples] = useState<SolutionExample[]>([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SolutionExample[]>("/api/solutions/examples").then(setExamples).catch(() => {});
  }, []);

  async function build(p: string, n: string) {
    setBuilding(true);
    setError(null);
    try {
      await fetchJson("/api/solutions/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: p, name: n }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Box sx={{ textAlign: "center", py: 8, maxWidth: 560, mx: "auto" }}>
      <LightbulbIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>What problem can we solve?</Typography>
      <Stack spacing={2} sx={{ mt: 3 }}>
        <TextField fullWidth label="Describe the problem" value={problem}
          onChange={(e) => setProblem(e.target.value)} multiline minRows={2} />
        <TextField fullWidth label="Solution name" value={name}
          onChange={(e) => setName(e.target.value)} />
        <Button variant="contained" size="large" disabled={!problem.trim() || !name.trim() || building}
          onClick={() => build(problem, name)}>
          {building ? <CircularProgress size={22} sx={{ mr: 1 }} /> : null}
          Solve It
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {examples.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Or try an example</Typography>
          <Grid container spacing={1.5}>
            {examples.map((ex) => (
              <Grid key={ex.name} size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
                  onClick={() => { setProblem(ex.problem); setName(ex.name); }}>
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>{ex.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{ex.problem}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}

export default function Solutions() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<Solution[]>("/api/solutions").then(setSolutions)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <Box sx={{ pt: 3 }}>
      <Skeleton variant="rounded" height={80} sx={{ mb: 3 }} />
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}><Skeleton variant="rounded" height={120} /></Grid>
        ))}
      </Grid>
    </Box>
  );
  if (error) return <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>;
  if (solutions.length === 0) return <EmptyState onCreated={load} />;

  const activeCount = solutions.filter((s) => s.status === "active").length;
  const totalUsage = solutions.reduce((sum, s) => sum + (s.usage_count ?? 0), 0);

  return (
    <Box sx={{ pt: 3 }}>
      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" spacing={4}>
          <Box>
            <Typography variant="h4" fontWeight={700}>{activeCount}</Typography>
            <Typography variant="body2" color="text.secondary">Active Solutions</Typography>
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>{totalUsage}</Typography>
            <Typography variant="body2" color="text.secondary">Total Uses</Typography>
          </Box>
        </Stack>
      </Card>

      <Grid container spacing={2}>
        {solutions.map((sol) => (
          <Grid key={sol.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <SolutionCard sol={sol} onAction={load} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
