import { Component, type ReactNode } from "react";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Collapse,
  Paper,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";

interface Checkpoint {
  sha: string;
  message: string;
  date: string;
}

interface Props {
  onRestored: () => void;
}

interface State {
  open: boolean;
  loading: boolean;
  restoring: boolean;
  checkpoints: Checkpoint[];
  selected: string | null;
  error: string | null;
}

export class CheckpointPicker extends Component<Props, State> {
  state: State = {
    open: false,
    loading: false,
    restoring: false,
    checkpoints: [],
    selected: null,
    error: null,
  };

  load = async () => {
    this.setState({ open: true, loading: true, error: null });
    try {
      const res = await fetch("/api/checkpoints");
      if (!res.ok) throw new Error(`${res.status}`);
      const checkpoints: Checkpoint[] = await res.json();
      this.setState({ checkpoints, loading: false });
    } catch (e) {
      this.setState({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  restore = async () => {
    const { selected } = this.state;
    if (!selected) return;
    if (!window.confirm("Restore to this checkpoint? Uncommitted changes will be stashed.")) {
      return;
    }
    this.setState({ restoring: true, error: null });
    try {
      const res = await fetch("/api/checkpoints/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      this.props.onRestored();
    } catch (e) {
      this.setState({
        restoring: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  render(): ReactNode {
    const { open, loading, restoring, checkpoints, selected, error } = this.state;

    if (!open) {
      return (
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestoreIcon />}
          onClick={this.load}
        >
          Restore checkpoint
        </Button>
      );
    }

    return (
      <Box sx={{ mt: 2, textAlign: "left" }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Select a checkpoint to restore:
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
            {error}
          </Typography>
        )}

        <Collapse in={checkpoints.length > 0}>
          <Paper variant="outlined" sx={{ maxHeight: 200, overflow: "auto", mb: 1.5 }}>
            <List dense disablePadding>
              {checkpoints.map((cp) => (
                <ListItemButton
                  key={cp.sha}
                  selected={selected === cp.sha}
                  onClick={() => this.setState({ selected: cp.sha })}
                >
                  <ListItemText
                    primary={cp.message}
                    secondary={`${cp.sha.slice(0, 7)} -- ${this.formatDate(cp.date)}`}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>

          <Button
            variant="contained"
            color="warning"
            size="small"
            disabled={!selected || restoring}
            startIcon={restoring ? <CircularProgress size={16} /> : <RestoreIcon />}
            onClick={this.restore}
          >
            {restoring ? "Restoring..." : "Restore"}
          </Button>
        </Collapse>
      </Box>
    );
  }
}
