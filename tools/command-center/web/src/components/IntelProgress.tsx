import { useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Collapse,
  IconButton,
  alpha,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TerminalIcon from "@mui/icons-material/Terminal";
import type { IntelRun, IntelRunProgress } from "../lib/api";

const PHASE_LABELS: Record<number, string> = {
  1: "Product Analysis",
  2: "Competitor Search",
  3: "Deep Dive",
  4: "Industry Leaders",
  5: "News Scan",
  6: "Article Analysis",
  7: "Suggestions",
  8: "Demo & Sales",
};

const EXPECTED_BY_DEPTH: Record<string, number[]> = {
  quick: [1, 2, 7],
  full: [1, 2, 3, 7],
  deep: [1, 2, 3, 4, 5, 6, 7, 8],
};

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function progressPercent(p: IntelRunProgress): number {
  if (p.expectedPhases === 0) return 0;
  return Math.round((p.completedPhases / p.expectedPhases) * 100);
}

export function ActiveRunBanner({
  run,
  logTail,
  onClick,
  onCancel,
}: {
  run: IntelRun;
  logTail?: string[];
  onClick: () => void;
  onCancel?: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);
  const progress = run.progress;
  if (!progress) return null;

  const pct = progressPercent(progress);
  const completedNums = new Set(run.phases.map((p) => p.order));
  const expectedNums = EXPECTED_BY_DEPTH[run.depth] ?? [1, 2, 3, 7];
  const hasLogs = logTail && logTail.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderColor: "warning.main",
        bgcolor: (t) => alpha(t.palette.warning.main, 0.04),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mb: 1.5, cursor: "pointer" }}
        onClick={onClick}
      >
        <HourglassEmptyIcon
          fontSize="small"
          color="warning"
          sx={{
            animation: "spin 2s linear infinite",
            "@keyframes spin": {
              "0%": { transform: "rotate(0deg)" },
              "100%": { transform: "rotate(360deg)" },
            },
          }}
        />
        <Typography variant="subtitle2" fontWeight={700}>
          Analysis Running
        </Typography>
        <Chip label={run.repo} size="small" color="primary" variant="outlined" />
        {run.focus && (
          <Chip label={run.focus} size="small" variant="outlined" />
        )}
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          {hasLogs && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setShowLogs((v) => !v); }}
              sx={{ color: "text.secondary" }}
              title="Toggle logs"
            >
              <TerminalIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="caption" color="text.secondary">
            {formatElapsed(progress.elapsedSec)}
          </Typography>
          {onCancel && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              sx={{ color: "error.main" }}
              title="Cancel analysis"
            >
              <CancelIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Stack>

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" fontWeight={600}>
            {progress.currentLabel ?? "Starting..."}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress.completedPhases}/{progress.expectedPhases} phases
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      <Stepper
        alternativeLabel
        activeStep={progress.completedPhases}
        sx={{ mt: 1.5, "& .MuiStepLabel-label": { fontSize: "0.65rem" } }}
      >
        {expectedNums.map((num) => (
          <Step key={num} completed={completedNums.has(num)}>
            <StepLabel>{PHASE_LABELS[num] ?? `Phase ${num}`}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {hasLogs && (
        <Collapse in={showLogs}>
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              bgcolor: "action.hover",
              borderRadius: 1,
              fontFamily: "monospace",
              fontSize: "0.7rem",
              lineHeight: 1.6,
              maxHeight: 180,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {logTail!.join("\n")}
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}

export function RunProgressBar({ progress }: { progress: IntelRunProgress }) {
  const pct = progressPercent(progress);
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
          {progress.currentLabel ?? "Starting..."}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
          {formatElapsed(progress.elapsedSec)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ height: 4, borderRadius: 2 }}
      />
    </Box>
  );
}
