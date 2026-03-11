import {
  Box,
  Chip,
  Typography,
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CircularProgress from "@mui/material/CircularProgress";
import { useState } from "react";
import type { AgentJob, AgentJobStatus, AgentJobType } from "../lib/api";

const JOB_LABELS: Record<AgentJobType, string> = {
  "profile-scan": "Profile Scan",
  "session-analysis": "Session Analysis",
  "codebase-scan": "Codebase Scan",
  "memory-synthesis": "Memory Synthesis",
  "skill-evolution": "Skill Evolution",
  "agent-synthesis": "Agent Synthesis",
  "intel-analysis": "Competitive Intel",
};

const STATUS_COLORS: Record<AgentJobStatus, "default" | "info" | "success" | "error" | "warning"> = {
  pending: "default",
  running: "info",
  completed: "success",
  failed: "error",
  skipped: "warning",
  cancelled: "default",
};

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatRelative(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

interface AgentJobRowProps {
  job: AgentJob;
}

export function AgentJobRow({ job }: AgentJobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasLog = job.logTail.length > 0;

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        py: 1,
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {job.status === "running" && (
          <CircularProgress size={14} thickness={5} />
        )}
        <Chip
          label={JOB_LABELS[job.type] ?? job.type}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.7rem" }}
        />
        <Chip
          label={job.status}
          size="small"
          color={STATUS_COLORS[job.status]}
          sx={{ fontSize: "0.7rem" }}
        />
        <Chip
          label={job.trigger}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.65rem", opacity: 0.7 }}
        />
        {job.durationMs !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {formatDuration(job.durationMs)}
          </Typography>
        )}
        {job.completedAt && (
          <Typography variant="caption" color="text.secondary">
            {formatRelative(job.completedAt)}
          </Typography>
        )}
        {job.detail && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {job.detail}
          </Typography>
        )}
        {hasLog && (
          <Tooltip title={expanded ? "Hide log" : "Show log"}>
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: "0.7rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {job.logTail.join("\n")}
        </Box>
      </Collapse>
    </Box>
  );
}
