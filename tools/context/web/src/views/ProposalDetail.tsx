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
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { MarkdownContent } from "../components/MarkdownContent";
import { useMqttSubscribe } from "../hooks/useMqtt";
import { api } from "../lib/api";

interface TaskFile {
  number: number;
  filename: string;
  name: string;
  agent: string;
  model: string;
  dependsOn: number[];
  status: string;
  content: string;
}

interface Proposal {
  slug: string;
  title: string;
  date: string;
  status: string;
  repo: string;
  ticket: string | null;
  taskCount: number;
  tasksByStatus: Record<string, number>;
  proposal: string;
  impact: string | null;
  tasks: TaskFile[];
}

const STATUS_ACCENT: Record<string, string> = {
  draft: "grey.500",
  "in-progress": "warning.main",
  completed: "success.main",
  rejected: "error.main",
};

const TASK_ACCENT: Record<string, string> = {
  pending: "grey.500",
  "in-progress": "warning.main",
  completed: "success.main",
  skipped: "grey.400",
};

export default function ProposalDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [selectedTask, setSelectedTask] = useState<TaskFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const subscribe = useMqttSubscribe();
  const unsubRef = useRef<(() => void)[]>([]);

  const load = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/proposals/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/proposals/${slug}: ${r.status}`);
        return r.json();
      })
      .then(setProposal)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Clean up MQTT subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const unsub of unsubRef.current) unsub();
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ pt: 3, maxWidth: 960, mx: "auto" }}>
        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  if (error || !proposal) {
    return (
      <Box sx={{ pt: 3, maxWidth: 960, mx: "auto" }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/solutions?tab=proposals")} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error ?? "Proposal not found"}</Alert>
      </Box>
    );
  }

  const progress = proposal.taskCount > 0
    ? Math.round(((proposal.tasksByStatus.completed ?? 0) / proposal.taskCount) * 100)
    : 0;

  async function handleBuild(taskNum?: number) {
    if (!slug) return;
    setBusy(true);
    try {
      const result = await api.buildProposal(slug, { task: taskNum });
      const label = taskNum ? `Building: ${slug} (task ${taskNum})` : `Building: ${slug}`;
      navigate(`/terminal?session=${result.sessionId}&label=${label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(taskNum?: number) {
    if (!slug) return;
    setBusy(true);
    try {
      const result = await api.editProposal(slug, { task: taskNum });
      const label = taskNum ? `Editing: ${slug} (task ${taskNum})` : `Editing: ${slug}`;
      navigate(`/terminal?session=${result.sessionId}&label=${label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluate() {
    if (!slug) return;
    // Clean up any previous subscriptions
    for (const unsub of unsubRef.current) unsub();
    unsubRef.current = [];

    setEvaluating(true);
    setEvaluation("");

    const evalTopic = `ctx/proposals/${slug}/eval`;
    const doneTopic = `ctx/proposals/${slug}/eval/done`;

    const unsubToken = subscribe(evalTopic, (payload) => {
      const { text } = payload as { text: string };
      setEvaluation((prev) => (prev ?? "") + text);
    });

    const unsubDone = subscribe(doneTopic, (payload) => {
      const data = payload as { error?: string };
      if (data.error) setError(data.error);
      setEvaluating(false);
      for (const unsub of unsubRef.current) unsub();
      unsubRef.current = [];
    });

    unsubRef.current = [unsubToken, unsubDone];

    try {
      await api.evaluateProposal(slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEvaluating(false);
      for (const unsub of unsubRef.current) unsub();
      unsubRef.current = [];
    }
  }

  async function handleDelete() {
    if (!slug) return;
    if (!window.confirm(`Delete proposal "${proposal.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteProposal(slug);
      navigate("/solutions?tab=proposals");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Box sx={{ pt: 2, maxWidth: 960, mx: "auto" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/solutions?tab=proposals")} size="small" sx={{ mb: 1 }}>
        Back
      </Button>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1, pl: 2, borderLeft: 4, borderLeftColor: STATUS_ACCENT[proposal.status] ?? "grey.500" }}
      >
        <Typography variant="h5" fontWeight={700}>{proposal.title}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {proposal.repo && (
            <Chip label={proposal.repo} size="small" variant="outlined" />
          )}
          {proposal.date && (
            <Typography variant="caption" color="text.secondary">{proposal.date}</Typography>
          )}
          <Tooltip title="Have AI re-evaluate if this proposal is still needed">
            <Button
              variant="outlined"
              size="small"
              startIcon={evaluating ? <CircularProgress size={16} /> : <FactCheckIcon />}
              onClick={handleEvaluate}
              disabled={busy || evaluating}
            >
              {evaluating ? "Evaluating..." : "Evaluate"}
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => handleEdit()}
            disabled={busy}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<RocketLaunchIcon />}
            onClick={() => handleBuild()}
            disabled={busy || proposal.status === "completed"}
          >
            Build
          </Button>
          <Tooltip title="Delete this proposal permanently">
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={busy}
            >
              Delete
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {proposal.tasksByStatus.completed ?? 0} / {proposal.taskCount} tasks completed
          </Typography>
          <Typography variant="caption" color="text.secondary">{progress}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
      </Box>

      <Collapse in={evaluation !== null}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: "info.main", borderLeft: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2">AI Evaluation</Typography>
              {evaluating && <CircularProgress size={14} />}
            </Stack>
            <Button size="small" onClick={() => setEvaluation(null)} disabled={evaluating}>Dismiss</Button>
          </Stack>
          {evaluation ? (
            <MarkdownContent content={evaluation} />
          ) : evaluating ? (
            <Typography variant="body2" color="text.secondary">Thinking...</Typography>
          ) : null}
          {!evaluating && evaluation && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
              <Button size="small" variant="outlined" color="success" onClick={() => handleSetStatus("completed")}>
                Mark Completed
              </Button>
              <Button size="small" variant="outlined" color="error" onClick={() => handleSetStatus("rejected")}>
                Reject
              </Button>
              <Button size="small" variant="outlined" color="error" onClick={handleDelete}>
                Delete
              </Button>
            </Stack>
          )}
        </Paper>
      </Collapse>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Design" />
        <Tab label={`Tasks (${proposal.taskCount})`} />
        <Tab label="Impact" disabled={!proposal.impact} />
      </Tabs>

      {tab === 0 && <DesignTab proposal={proposal.proposal} />}
      {tab === 1 && (
        <TasksTab
          tasks={proposal.tasks}
          selected={selectedTask}
          onSelect={setSelectedTask}
          onBuild={handleBuild}
          onEdit={handleEdit}
          busy={busy}
        />
      )}
      {tab === 2 && proposal.impact && <ImpactTab impact={proposal.impact} />}
    </Box>
  );
}

function DesignTab({ proposal }: { proposal: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <MarkdownContent content={proposal} />
    </Paper>
  );
}

function TasksTab({
  tasks,
  selected,
  onSelect,
  onBuild,
  onEdit,
  busy,
}: {
  tasks: TaskFile[];
  selected: TaskFile | null;
  onSelect: (t: TaskFile | null) => void;
  onBuild: (taskNum: number) => void;
  onEdit: (taskNum: number) => void;
  busy: boolean;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ minHeight: 400 }}>
      {/* Task list */}
      <Box sx={{ width: 320, flexShrink: 0, overflow: "auto" }}>
        <Stack spacing={1}>
          {tasks.map((t) => (
            <Card
              key={t.number}
              variant="outlined"
              sx={{
                cursor: "pointer",
                borderLeft: 4,
                borderLeftColor: TASK_ACCENT[t.status] ?? "grey.500",
                borderColor: selected?.number === t.number ? "primary.main" : undefined,
                borderWidth: selected?.number === t.number ? 2 : 1,
                borderLeftWidth: 4,
                "&:hover": { borderColor: "primary.main", borderLeftWidth: 4, borderLeftColor: TASK_ACCENT[t.status] ?? "grey.500" },
              }}
              onClick={() => onSelect(selected?.number === t.number ? null : t)}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {String(t.number).padStart(2, "0")}: {t.name}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
                  <Chip label={t.agent} size="small" sx={{ fontSize: "0.65rem", height: 18 }} />
                  <Chip label={t.model} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 18 }} />
                  {t.dependsOn.length > 0 && (
                    <Tooltip title={`Depends on: ${t.dependsOn.join(", ")}`}>
                      <Chip
                        label={`deps: ${t.dependsOn.join(",")}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.65rem", height: 18 }}
                      />
                    </Tooltip>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Edit with AI">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); onEdit(t.number); }}
                        sx={{ minWidth: 0, px: 0.75, height: 24 }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Build with AI">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busy || t.status === "completed"}
                        onClick={(e) => { e.stopPropagation(); onBuild(t.number); }}
                        sx={{ minWidth: 0, px: 0.75, height: 24 }}
                      >
                        <RocketLaunchIcon sx={{ fontSize: 14 }} />
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Task detail */}
      <Paper variant="outlined" sx={{ flex: 1, p: 3, overflow: "auto" }}>
        {selected ? (
          <MarkdownContent content={selected.content} />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
            <Typography variant="body2">Select a task to view details</Typography>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function ImpactTab({ impact }: { impact: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <MarkdownContent content={impact} />
    </Paper>
  );
}
