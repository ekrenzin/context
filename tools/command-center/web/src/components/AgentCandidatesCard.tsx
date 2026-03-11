import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
} from "@mui/material";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { api } from "../lib/api";
import type { AgentCandidate } from "../lib/api";

interface CandidateRowProps {
  candidate: AgentCandidate;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

function CandidateRow({ candidate: c, applying, onApply, onDismiss }: CandidateRowProps) {
  const [expanded, setExpanded] = useState(false);
  const confidencePct = Math.round(c.confidence * 100);

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1, "&:last-child": { borderBottom: 0, pb: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Chip
            label="new"
            size="small"
            color="secondary"
            variant="outlined"
            sx={{ fontSize: "0.65rem", flexShrink: 0 }}
          />
          <Chip
            label={`${c.frequency} sessions`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: "0.65rem", flexShrink: 0 }}
          />
          <Tooltip title={`Confidence: ${confidencePct}%`}>
            <Box sx={{ width: 40, flexShrink: 0 }}>
              <LinearProgress
                variant="determinate"
                value={confidencePct}
                color={confidencePct >= 80 ? "success" : confidencePct >= 60 ? "warning" : "error"}
                sx={{ borderRadius: 1, height: 4 }}
              />
            </Box>
          </Tooltip>
          <Typography
            variant="body2"
            noWrap
            sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            onClick={() => setExpanded((p) => !p)}
          >
            {c.agentName}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Tooltip title={expanded ? "Collapse" : "Preview SKILL.md and triggers"}>
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Apply — write agent SKILL.md to .cursor/skills/agents/">
            <IconButton size="small" color="success" disabled={applying} onClick={onApply}>
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dismiss without applying">
            <IconButton size="small" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
            {c.skills.map((s) => (
              <Chip key={s} label={s} size="small" variant="filled" sx={{ fontSize: "0.6rem" }} />
            ))}
          </Box>
          {c.triggerPhrases.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Triggers
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {c.triggerPhrases.map((p) => (
                  <Chip
                    key={p}
                    label={`"${p}"`}
                    size="small"
                    variant="outlined"
                    color="secondary"
                    sx={{ fontSize: "0.6rem" }}
                  />
                ))}
              </Box>
            </Box>
          )}
          <Typography variant="caption" color="secondary.main" sx={{ display: "block", mb: 0.5 }}>
            Generated SKILL.md
          </Typography>
          <Box
            sx={{
              p: 1,
              bgcolor: "action.hover",
              borderRadius: 1,
              fontFamily: "monospace",
              fontSize: "0.68rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 280,
              overflow: "auto",
              lineHeight: 1.5,
              border: 1,
              borderColor: "secondary.main",
              borderStyle: "dashed",
              opacity: 0.9,
            }}
          >
            {c.skillMd || "(empty)"}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export function AgentCandidatesCard() {
  const [candidates, setCandidates] = useState<AgentCandidate[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    api.agentCandidates()
      .then(setCandidates)
      .catch(() => {});
  }, []);

  async function apply(candidate: AgentCandidate) {
    setApplying(candidate.agentName);
    await api.applyAgentCandidate(candidate).catch(() => {});
    setCandidates((prev) => prev.filter((c) => c.agentName !== candidate.agentName));
    setApplying(null);
  }

  async function dismiss(agentName: string) {
    await api.dismissAgentCandidate(agentName).catch(() => {});
    setCandidates((prev) => prev.filter((c) => c.agentName !== agentName));
  }

  if (candidates.length === 0) return null;

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<PrecisionManufacturingIcon fontSize="small" color="secondary" />}
        title={<Typography variant="subtitle1" fontWeight={600}>Agent Candidates</Typography>}
        subheader={
          <Typography variant="caption" color="text.secondary">
            {candidates.length} agent{candidates.length !== 1 ? "s" : ""} discovered from session patterns — preview before applying
          </Typography>
        }
        sx={{ pb: 0 }}
      />
      <Divider sx={{ mx: 2 }} />
      <CardContent sx={{ pt: 1.5 }}>
        <Stack spacing={1}>
          {candidates.map((c) => (
            <CandidateRow
              key={c.agentName}
              candidate={c}
              applying={applying === c.agentName}
              onApply={() => apply(c)}
              onDismiss={() => dismiss(c.agentName)}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
