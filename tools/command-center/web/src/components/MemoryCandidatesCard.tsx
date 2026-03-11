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
  Stack,
  Tooltip,
} from "@mui/material";
import MemoryIcon from "@mui/icons-material/Memory";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { MemoryCandidate } from "../lib/api";

interface CandidateRowProps {
  candidate: MemoryCandidate;
  promoting: boolean;
  onPromote: () => void;
  onDismiss: () => void;
}

function CandidateRow({ candidate: c, promoting, onPromote, onDismiss }: CandidateRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1, "&:last-child": { borderBottom: 0, pb: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Chip label={c.category} size="small" color="warning" variant="outlined" sx={{ fontSize: "0.65rem", flexShrink: 0 }} />
          <Typography
            variant="body2"
            noWrap
            sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            onClick={() => setExpanded((p) => !p)}
          >
            {c.filename}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Tooltip title={expanded ? "Hide content" : "Preview content"}>
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Promote to committed memory">
            <IconButton size="small" color="success" disabled={promoting} onClick={onPromote}>
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dismiss candidate">
            <IconButton size="small" color="default" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: "0.68rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 200,
            overflow: "auto",
            lineHeight: 1.5,
          }}
        >
          {c.content}
        </Box>
      </Collapse>
    </Box>
  );
}

export function MemoryCandidatesCard() {
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [promoting, setPromoting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents/memory-candidates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MemoryCandidate[]) => setCandidates(data))
      .catch(() => {});
  }, []);

  async function promote(candidate: MemoryCandidate) {
    setPromoting(candidate.filename);
    await fetch("/api/agents/memory-candidates/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    }).catch(() => {});
    setCandidates((prev) => prev.filter((c) => c.filename !== candidate.filename));
    setPromoting(null);
  }

  function dismiss(filename: string) {
    setCandidates((prev) => prev.filter((c) => c.filename !== filename));
  }

  if (candidates.length === 0) return null;

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<MemoryIcon fontSize="small" color="warning" />}
        title={<Typography variant="subtitle1" fontWeight={600}>Memory Candidates</Typography>}
        subheader={
          <Typography variant="caption" color="text.secondary">
            {candidates.length} pending — preview content before promoting
          </Typography>
        }
        sx={{ pb: 0 }}
      />
      <Divider sx={{ mx: 2 }} />
      <CardContent sx={{ pt: 1.5 }}>
        <Stack spacing={1}>
          {candidates.map((c) => (
            <CandidateRow
              key={c.filename}
              candidate={c}
              promoting={promoting === c.filename}
              onPromote={() => promote(c)}
              onDismiss={() => dismiss(c.filename)}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
