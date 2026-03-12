import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Button,
  Collapse,
  LinearProgress,
  Alert,
} from "@mui/material";
import MemoryIcon from "@mui/icons-material/Memory";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SyncIcon from "@mui/icons-material/Sync";
import UpdateIcon from "@mui/icons-material/Update";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useMqttTopic, useMqttConnected } from "../hooks/useMqtt";
import { topicFor } from "ctx-mqtt/topics";

interface AgentJob {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
  trigger: "periodic" | "manual";
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  detail?: string;
  logTail: string[];
  exitCode?: number;
}

interface FingerprintSources {
  transcripts: string;
  repos: string;
  memory: string;
}

interface AgentSchedulerState {
  jobs: AgentJob[];
  lastCheckedAt: string;
  lastFingerprint: string;
  fingerprintSources: FingerprintSources;
  nextRunAt: string;
  running: boolean;
  intervalMs: number;
}

interface SkillsSyncStatus {
  state: "current" | "error" | "unknown";
  totalSkills: number;
  linked: number;
  skipped: string[];
  lastSyncedAt: string;
  cacheDir: string;
  targetDir: string;
  updated?: boolean;
  error?: string;
}

interface UpdateStatus {
  branch: string;
  sha: string;
  commitMessage?: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  state: "current" | "behind" | "ahead" | "diverged" | "error" | "unknown";
  lastCheckedAt: string;
  autoUpdated: boolean;
  previousSha?: string;
  error?: string;
  stashConflict?: boolean;
}

function relativeTime(iso: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function statusColor(s: string): "success" | "error" | "warning" | "info" | "default" {
  switch (s) {
    case "current": case "completed": return "success";
    case "error": case "failed": return "error";
    case "running": case "behind": case "diverged": return "warning";
    case "pending": return "info";
    default: return "default";
  }
}

function durationLabel(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function JobRow({ job }: { job: AgentJob }) {
  const [expanded, setExpanded] = useState(false);
  const hasLogs = job.logTail.length > 0;

  return (
    <Card variant="outlined" sx={{ mb: 0.5 }}>
      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={job.status}
            size="small"
            color={statusColor(job.status)}
            variant="outlined"
            sx={{ fontSize: "0.65rem", minWidth: 72 }}
          />
          <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
            {job.type}
          </Typography>
          {job.trigger === "manual" && (
            <Chip label="manual" size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
          )}
          {job.durationMs != null && (
            <Typography variant="caption" color="text.secondary">
              {durationLabel(job.durationMs)}
            </Typography>
          )}
          {job.status === "running" && (
            <LinearProgress sx={{ width: 48, height: 4, borderRadius: 2 }} />
          )}
          {hasLogs && (
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </Box>
        {job.detail && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.25, display: "block" }}>
            {job.detail}
          </Typography>
        )}
        <Collapse in={expanded}>
          <Box
            component="pre"
            sx={{
              mt: 1,
              p: 1,
              bgcolor: "action.hover",
              borderRadius: 1,
              fontSize: "0.7rem",
              lineHeight: 1.4,
              overflow: "auto",
              maxHeight: 200,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {job.logTail.join("\n")}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function AgentSchedulerCard({ state }: { state: AgentSchedulerState | null }) {
  const [showAll, setShowAll] = useState(false);

  const triggerPipeline = useCallback(() => {
    fetch("/api/agents/trigger", { method: "POST" }).catch(() => {});
  }, []);

  const cancelPipeline = useCallback(() => {
    fetch("/api/agents/cancel", { method: "POST" }).catch(() => {});
  }, []);

  if (!state) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <SmartToyIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Agent Scheduler</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Waiting for data...</Typography>
        </CardContent>
      </Card>
    );
  }

  const visibleJobs = showAll ? state.jobs : state.jobs.slice(0, 7);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <SmartToyIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>Agent Scheduler</Typography>
          <Chip
            label={state.running ? "running" : "idle"}
            size="small"
            color={state.running ? "warning" : "default"}
            variant="outlined"
          />
          <Box sx={{ flex: 1 }} />
          {state.running ? (
            <Tooltip title="Cancel pipeline">
              <IconButton size="small" onClick={cancelPipeline} color="error">
                <StopIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Trigger pipeline now">
              <IconButton size="small" onClick={triggerPipeline} color="primary">
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Last check: {relativeTime(state.lastCheckedAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Next run: {relativeTime(state.nextRunAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Interval: {state.intervalMs / 60_000}m
          </Typography>
        </Stack>

        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Fingerprint sources
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Chip label={`transcripts: ${state.fingerprintSources.transcripts.split(":")[0] || "0"}`} size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
            <Chip label={`repos: ${state.fingerprintSources.repos || "none"}`} size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
            <Chip label={`memory: ${state.fingerprintSources.memory ? "tracked" : "none"}`} size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
          </Stack>
        </Box>

        {state.running && <LinearProgress sx={{ mb: 1.5, borderRadius: 2 }} />}

        {state.jobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No jobs yet</Typography>
        ) : (
          <>
            {visibleJobs.map((j) => <JobRow key={j.id} job={j} />)}
            {state.jobs.length > 7 && (
              <Button size="small" onClick={() => setShowAll((p) => !p)} sx={{ mt: 0.5 }}>
                {showAll ? "Show less" : `Show all ${state.jobs.length} jobs`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SkillsSyncCard({ status }: { status: SkillsSyncStatus | null }) {
  if (!status) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <SyncIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Skills Sync</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Waiting for data...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <SyncIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>Skills Sync</Typography>
          <Chip
            label={status.state}
            size="small"
            color={statusColor(status.state)}
            variant="outlined"
          />
          {status.updated && (
            <Chip label="updated" size="small" color="info" variant="outlined" />
          )}
        </Box>

        {status.error && (
          <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>
            {status.error}
          </Alert>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2">
            <strong>{status.totalSkills}</strong> skills available, <strong>{status.linked}</strong> linked
          </Typography>
          {status.skipped.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Skipped: {status.skipped.join(", ")}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Last synced: {relativeTime(status.lastSyncedAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Cache: {status.cacheDir}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Target: {status.targetDir}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function UpdateCheckerCard({ status }: { status: UpdateStatus | null }) {
  const triggerCheck = useCallback(() => {
    fetch("/api/updates/check", { method: "POST" }).catch(() => {});
  }, []);

  if (!status) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <UpdateIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Update Checker</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Waiting for data...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <UpdateIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>Update Checker</Typography>
          <Chip
            label={status.state}
            size="small"
            color={statusColor(status.state)}
            variant="outlined"
          />
          {status.autoUpdated && (
            <Chip label="auto-updated" size="small" color="success" variant="outlined" />
          )}
          {status.stashConflict && (
            <Chip label="stash conflict" size="small" color="warning" variant="outlined" />
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Check for updates">
            <IconButton size="small" onClick={triggerCheck} color="primary">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {status.error && (
          <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>
            {status.error}
          </Alert>
        )}

        <Stack spacing={0.5}>
          <Typography variant="body2">
            Branch: <strong>{status.branch}</strong> @ <code>{status.sha}</code>
          </Typography>
          {status.commitMessage && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {status.commitMessage}
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            {status.ahead > 0 && <Chip label={`${status.ahead} ahead`} size="small" color="info" variant="outlined" sx={{ fontSize: "0.65rem" }} />}
            {status.behind > 0 && <Chip label={`${status.behind} behind`} size="small" color="warning" variant="outlined" sx={{ fontSize: "0.65rem" }} />}
            {status.dirty && <Chip label="dirty" size="small" color="warning" variant="outlined" sx={{ fontSize: "0.65rem" }} />}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Last checked: {relativeTime(status.lastCheckedAt)}
          </Typography>
          {status.previousSha && (
            <Typography variant="caption" color="text.secondary">
              Updated from {status.previousSha}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MqttStatusCard() {
  const connected = useMqttConnected();

  return (
    <Card>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: connected ? "success.main" : "error.main",
            }}
          />
          <Typography variant="body2" fontWeight={600}>
            MQTT Broker
          </Typography>
          <Chip
            label={connected ? "connected" : "disconnected"}
            size="small"
            color={connected ? "success" : "error"}
            variant="outlined"
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Processes() {
  const agents = useMqttTopic<AgentSchedulerState>(topicFor("agents"));
  const skillsSync = useMqttTopic<SkillsSyncStatus>(topicFor("skills-sync"));
  const updates = useMqttTopic<UpdateStatus>(topicFor("updates"));

  return (
    <Box sx={{ pt: 2, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <MemoryIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Processes</Typography>
      </Box>

      <Stack spacing={2}>
        <MqttStatusCard />
        <UpdateCheckerCard status={updates} />
        <SkillsSyncCard status={skillsSync} />
        <AgentSchedulerCard state={agents} />
      </Stack>
    </Box>
  );
}
