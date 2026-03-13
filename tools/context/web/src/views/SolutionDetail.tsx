import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Alert,
  Skeleton,
  Tab,
  Tabs,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteIcon from "@mui/icons-material/Delete";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { OverviewTab, ViewTab, CodeTab, LogsTab } from "./SolutionTabs";
import type { SolutionData } from "./SolutionTabs";

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

interface TabDef {
  key: string;
  label: string;
}

function buildTabs(solution: SolutionData): TabDef[] {
  const tabs: TabDef[] = [{ key: "overview", label: "Overview" }];
  if (solution.components.some((c) => c.type === "view")) {
    tabs.push({ key: "view", label: "View" });
  }
  tabs.push({ key: "code", label: "Code" });
  if (solution.components.some((c) => c.type === "service")) {
    tabs.push({ key: "logs", label: "Logs" });
  }
  return tabs;
}

export default function SolutionDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchJson<SolutionData>(`/api/solutions/${id}`)
      .then(setSolution)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const running = solution?.status === "active" || solution?.status === "building";
  const healthRunning = solution?.health?.running ?? false;
  const hasService = solution?.components.some((c) => c.type === "service") ?? false;
  const statusMismatch = solution?.status === "active" && !healthRunning;

  const tabs = useMemo(() => solution ? buildTabs(solution) : [], [solution]);
  const activeTab = tabs[tabIndex]?.key ?? "overview";

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

  const statusColor = STATUS_COLOR[solution.status] ?? "error";
  const logsTabIndex = tabs.findIndex((t) => t.key === "logs");

  return (
    <Box sx={{ pt: 2, maxWidth: 900, mx: "auto" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/solutions")} size="small" sx={{ mb: 1 }}>
        Back
      </Button>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h5" fontWeight={700}>{solution.name}</Typography>
          {hasService && (
            <FiberManualRecordIcon sx={{ fontSize: 10, color: healthRunning ? "success.main" : "text.disabled" }} />
          )}
          <Chip label={solution.status} color={statusColor} size="small" />
        </Stack>
        <Stack direction="row" spacing={1}>
          {hasService && (
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
          )}
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={remove} disabled={actionLoading}>
            Delete
          </Button>
        </Stack>
      </Stack>

      {solution.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {solution.description}
        </Typography>
      )}

      {statusMismatch && (
        <Alert severity="warning" sx={{ mb: 1 }} action={
          logsTabIndex >= 0 ? <Button size="small" onClick={() => setTabIndex(logsTabIndex)}>View Logs</Button> : undefined
        }>
          Status is "active" but the process is not running. Check the Logs tab.
        </Alert>
      )}

      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        {tabs.map((t) => <Tab key={t.key} label={t.label} />)}
      </Tabs>

      {activeTab === "overview" && <OverviewTab solution={solution} />}
      {activeTab === "view" && <ViewTab id={solution.id} running={healthRunning} name={solution.name} />}
      {activeTab === "code" && <CodeTab id={solution.id} />}
      {activeTab === "logs" && <LogsTab id={solution.id} />}
    </Box>
  );
}
