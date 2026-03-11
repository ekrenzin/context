import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
  Divider,
  Drawer,
  Skeleton,
  Alert,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SyncIcon from "@mui/icons-material/Sync";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import { useAgents } from "../hooks/useAgents";
import { AgentJobRow } from "../components/AgentJobRow";
import { AgentCandidatesCard } from "../components/AgentCandidatesCard";
import { MemoryCandidatesCard } from "../components/MemoryCandidatesCard";
import { SkillCandidatesCard } from "../components/SkillCandidatesCard";
import type { AgentJobType } from "../lib/api";

const JOB_LABELS: Record<AgentJobType, string> = {
  "profile-scan": "Profile Scan",
  "session-analysis": "Analyze Sessions",
  "codebase-scan": "Codebase Scan",
  "memory-synthesis": "Memory Synthesis",
  "skill-evolution": "Skill Evolution",
  "agent-synthesis": "Agent Synthesis",
  "intel-analysis": "Competitive Intel",
};

function useCountdown(targetIso: string): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function update() {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setLabel("now"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${m}:${String(s).padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return label;
}

export function Agents() {
  const { state, loading, trigger, triggerJob, cancel } = useAgents();
  const countdown = useCountdown(state?.nextRunAt ?? new Date(Date.now() + 600000).toISOString());
  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2].map((i) => <Grid item xs={12} md={6} key={i}><Skeleton variant="rounded" height={200} /></Grid>)}
        </Grid>
      </Box>
    );
  }

  if (!state) {
    return <Alert severity="error" sx={{ mt: 3 }}>Agent scheduler unavailable.</Alert>;
  }

  const activeJobs = state.jobs.filter((j) => j.status === "running" || j.status === "pending");
  const historyJobs = state.jobs.filter((j) => j.status !== "running" && j.status !== "pending");

  return (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" fontWeight={700}>Agents</Typography>
        <Chip
          size="small"
          icon={<SmartToyIcon sx={{ fontSize: "12px !important" }} />}
          label={state.running ? "pipeline running" : `next scan in ${countdown}`}
          color={state.running ? "info" : "default"}
          variant="outlined"
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<PlayArrowIcon />}
          disabled={state.running}
          onClick={trigger}
        >
          Run All
        </Button>
        {state.running && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={cancel}
          >
            Cancel
          </Button>
        )}
        <Tooltip title={`Transcripts: ${state.fingerprintSources.transcripts.split(":")[0]} files`}>
          <Chip size="small" label="transcripts" variant="outlined" sx={{ fontSize: "0.65rem" }} />
        </Tooltip>
        <Tooltip title={`Repos: ${state.fingerprintSources.repos || "none"}`}>
          <Chip size="small" label="repos" variant="outlined" sx={{ fontSize: "0.65rem" }} />
        </Tooltip>
        <Tooltip title={`Memory mtime: ${state.fingerprintSources.memory}`}>
          <Chip size="small" label="memory" variant="outlined" sx={{ fontSize: "0.65rem" }} />
        </Tooltip>
        <Box sx={{ ml: "auto" }}>
          <Tooltip title="Job History">
            <IconButton size="small" onClick={() => setHistoryOpen(true)}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {(Object.entries(JOB_LABELS) as [AgentJobType, string][]).map(([type, label]) => (
          <Tooltip key={type} title={`Run ${label} only`}>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={state.running}
                onClick={() => triggerJob(type)}
                sx={{ fontSize: "0.7rem", textTransform: "none", opacity: 0.8 }}
              >
                {label}
              </Button>
            </span>
          </Tooltip>
        ))}
      </Box>

      <Grid container spacing={2}>
        {activeJobs.length > 0 && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader
                avatar={<SmartToyIcon fontSize="small" color="primary" />}
                title={<Typography variant="subtitle1" fontWeight={600}>Active Pipeline</Typography>}
                action={<SyncIcon sx={{ mr: 1, mt: 1, animation: "spin 2s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} color="primary" />}
                sx={{ pb: 0 }}
              />
              <Divider sx={{ mx: 2 }} />
              <CardContent sx={{ pt: 1 }}>
                {activeJobs.map((job) => <AgentJobRow key={job.id} job={job} />)}
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <MemoryCandidatesCard />
        </Grid>

        <Grid item xs={12} md={6}>
          <SkillCandidatesCard />
        </Grid>

        <Grid item xs={12}>
          <AgentCandidatesCard />
        </Grid>
      </Grid>

      <Drawer
        anchor="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{ sx: { width: 480, p: 2, top: 64, height: "calc(100% - 64px)" } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Job History</Typography>
          <IconButton size="small" onClick={() => setHistoryOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        {historyJobs.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No completed jobs yet. The pipeline runs every 10 minutes when changes are detected.
          </Alert>
        ) : (
          historyJobs.slice(0, 30).map((job) => <AgentJobRow key={job.id} job={job} />)
        )}
      </Drawer>
    </Box>
  );
}
