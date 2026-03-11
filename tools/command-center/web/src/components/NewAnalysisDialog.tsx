import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { api } from "../lib/api";

const REPOS = [
  { value: "app-platform", label: "SOS Platform" },
  { value: "app-notifier", label: "SOS Notifier" },
  { value: "app-gateway", label: "EAS Gateway" },
  { value: "conmon-dashboard", label: "ConMon Dashboard" },
  { value: "lora-firmware", label: "LoRa Firmware" },
  { value: "sentinel-gateway-communicator", label: "Sentinel Gateway" },
];

const DEPTHS = [
  { value: "quick", label: "Quick", hint: "Product analysis + competitor search + suggestions" },
  { value: "full", label: "Full", hint: "Adds competitor deep dives via browser" },
  { value: "deep", label: "Deep", hint: "All phases including industry leaders and news scan" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewAnalysisDialog({ open, onClose, onCreated }: Props) {
  const [repo, setRepo] = useState("app-platform");
  const [depth, setDepth] = useState("full");
  const [focus, setFocus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    setSubmitting(true);
    try {
      const { runId } = await api.createIntelRun(repo, depth, focus || undefined);
      await api.triggerIntelAnalysis(repo, depth, runId, focus || undefined);
      onCreated();
      onClose();
    } catch {
      // keep dialog open on failure so user can retry
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  const depthMeta = DEPTHS.find((d) => d.value === depth);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TravelExploreIcon color="primary" fontSize="small" />
        New Competitive Analysis
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            select
            label="Target Repository"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            size="small"
            fullWidth
          >
            {REPOS.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>

          <div>
            <TextField
              select
              label="Analysis Depth"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              size="small"
              fullWidth
            >
              {DEPTHS.map((d) => (
                <MenuItem key={d.value} value={d.value}>
                  {d.label}
                </MenuItem>
              ))}
            </TextField>
            {depthMeta && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {depthMeta.hint}
              </Typography>
            )}
          </div>

          <TextField
            label="Focus Area (optional)"
            placeholder="e.g. notifications, dispatch, video"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            size="small"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleStart}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : <TravelExploreIcon />}
        >
          {submitting ? "Starting..." : "Start Analysis"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
