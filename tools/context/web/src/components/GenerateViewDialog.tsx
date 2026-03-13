import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

export function GenerateViewDialog({ open, onClose, onGenerated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!name.trim() || !description.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/views/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }

      setName("");
      setDescription("");
      onGenerated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleClose() {
    if (generating) return;
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AutoFixHighIcon color="primary" />
        <Typography variant="h6" component="span">Generate View</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <TextField
            label="View name"
            placeholder="e.g. ToolUsage"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={generating}
            fullWidth
            helperText="PascalCase component name"
          />

          <TextField
            label="What should this view show?"
            placeholder="e.g. A chart showing which tools are used most across sessions, with a bar graph and a filterable date range"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={generating}
            fullWidth
            multiline
            rows={4}
          />

          {generating && (
            <Alert severity="info" icon={<CircularProgress size={20} />}>
              Generating component with AI... This may take 10-30 seconds.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={generating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!name.trim() || !description.trim() || generating}
          disableElevation
          startIcon={generating ? <CircularProgress size={18} /> : <AutoFixHighIcon />}
        >
          {generating ? "Generating..." : "Generate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
