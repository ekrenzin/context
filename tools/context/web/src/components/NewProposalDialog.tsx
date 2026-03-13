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
import DescriptionIcon from "@mui/icons-material/Description";
import { api } from "../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

export function NewProposalDialog({ open, onClose, onCreated }: Props) {
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!description.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const result = await api.createProposal(description.trim());
      setDescription("");
      onCreated(result.sessionId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    if (creating) return;
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DescriptionIcon color="primary" />
        <Typography variant="h6" component="span">New Proposal</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Describe what you want to build. An AI agent will create the
            proposal structure and work with you to refine the spec.
          </Typography>

          <TextField
            label="What do you want to build?"
            placeholder="e.g. Add a notification system that alerts users via email and in-app when their proposals are approved or rejected"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={creating}
            fullWidth
            multiline
            rows={5}
            autoFocus
          />

          {creating && (
            <Alert severity="info" icon={<CircularProgress size={20} />}>
              Launching AI agent to draft your proposal...
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={creating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!description.trim() || creating}
          disableElevation
          startIcon={creating ? <CircularProgress size={18} /> : <DescriptionIcon />}
        >
          {creating ? "Creating..." : "Create Proposal"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
