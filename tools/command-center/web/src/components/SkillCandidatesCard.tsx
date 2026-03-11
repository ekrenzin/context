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
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { api } from "../lib/api";
import type { SkillCandidate } from "../lib/api";

interface CandidateRowProps {
  candidate: SkillCandidate;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

function CandidateRow({
  candidate: c,
  applying,
  onApply,
  onDismiss,
}: CandidateRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        pb: 1,
        "&:last-child": { borderBottom: 0, pb: 0 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          <Chip
            label="update"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: "0.65rem", flexShrink: 0 }}
          />
          <Chip
            label={`${c.analysisCount} analyses`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: "0.65rem", flexShrink: 0 }}
          />
          {c.resources.length > 0 && (
            <Chip
              label={`+${c.resources.length} files`}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.65rem", flexShrink: 0 }}
            />
          )}
          <Typography
            variant="body2"
            noWrap
            sx={{
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
            onClick={() => setExpanded((p) => !p)}
          >
            {c.skillName}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Tooltip
            title={
              expanded ? "Hide proposed content" : "Preview proposed changes"
            }
          >
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Apply — write proposed SKILL.md and resource files">
            <IconButton
              size="small"
              color="success"
              disabled={applying}
              onClick={onApply}
            >
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
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Current SKILL.md
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
                  maxHeight: 240,
                  overflow: "auto",
                  lineHeight: 1.5,
                }}
              >
                {c.currentMd || "(empty)"}
              </Box>
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="success.main"
                sx={{ display: "block", mb: 0.5 }}
              >
                Proposed update
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
                  maxHeight: 240,
                  overflow: "auto",
                  lineHeight: 1.5,
                  border: 1,
                  borderColor: "success.main",
                  borderStyle: "dashed",
                  opacity: 0.9,
                }}
              >
                {c.skillMd || "(no changes)"}
              </Box>
            </Box>
          </Box>
          {c.resources.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                New resource files ({c.resources.length})
              </Typography>
              {c.resources.map((r) => (
                <Typography
                  key={r.path}
                  variant="caption"
                  color="primary"
                  sx={{ display: "block", fontFamily: "monospace" }}
                >
                  + {r.path}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export function SkillCandidatesCard() {
  const [candidates, setCandidates] = useState<SkillCandidate[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    api
      .skillCandidates()
      .then(setCandidates)
      .catch(() => {});
  }, []);

  async function apply(candidate: SkillCandidate) {
    setApplying(candidate.skillName);
    await api.applySkillCandidate(candidate).catch(() => {});
    setCandidates((prev) =>
      prev.filter((c) => c.skillName !== candidate.skillName),
    );
    setApplying(null);
  }

  async function dismiss(skillName: string) {
    await api.dismissSkillCandidate(skillName).catch(() => {});
    setCandidates((prev) => prev.filter((c) => c.skillName !== skillName));
  }

  if (candidates.length === 0) return null;

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<AutoFixHighIcon fontSize="small" color="primary" />}
        title={
          <Typography variant="subtitle1" fontWeight={600}>
            Skill Candidates
          </Typography>
        }
        subheader={
          <Typography variant="caption" color="text.secondary">
            {candidates.length} skill update{candidates.length !== 1 ? "s" : ""}{" "}
            proposed — preview before applying
          </Typography>
        }
        sx={{ pb: 0 }}
      />
      <Divider sx={{ mx: 2 }} />
      <CardContent sx={{ pt: 1.5 }}>
        <Stack spacing={1}>
          {candidates.map((c) => (
            <CandidateRow
              key={c.skillName}
              candidate={c}
              applying={applying === c.skillName}
              onApply={() => apply(c)}
              onDismiss={() => dismiss(c.skillName)}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
