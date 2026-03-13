import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api } from "../../lib/api";

interface ToolState {
  installed: boolean;
  version: string | null;
}

interface Status {
  claude: ToolState;
  codex: ToolState;
}

export function CliToolsStep({ onComplete, onBack, onSkip }: {
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.cliToolsStatus();
      setStatus(s);
    } catch {
      setStatus({
        claude: { installed: false, version: null },
        codex: { installed: false, version: null },
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!status || loading) return;
    if (status.claude.installed && status.codex.installed) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, loading, onComplete]);

  async function handleInstall(tool: "claude" | "codex") {
    setInstalling(tool);
    setError(null);
    try {
      const result = await api.cliToolsInstall(tool);
      if (!result.success) {
        setError(result.error ?? `Failed to install ${tool}`);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setInstalling(null);
  }

  const allReady = status?.claude.installed && status?.codex.installed;

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", px: 3, textAlign: "center" }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        AI Coding CLIs
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Install the Claude Code and Codex command-line tools for AI-powered
        coding directly from your terminal.
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : allReady ? (
        <Stack alignItems="center" spacing={2}>
          <CheckCircleIcon sx={{ fontSize: 64, color: "success.main" }} />
          <Typography variant="h6" color="success.main">
            Both CLIs ready
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={`claude ${status!.claude.version}`} color="success" />
            <Chip label={`codex ${status!.codex.version}`} color="success" />
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={3} alignItems="center">
          <ToolRow
            name="Claude Code"
            bin="claude"
            state={status!.claude}
            installing={installing === "claude"}
            onInstall={() => handleInstall("claude")}
          />
          <ToolRow
            name="Codex"
            bin="codex"
            state={status!.codex}
            installing={installing === "codex"}
            onInstall={() => handleInstall("codex")}
          />
          {error && (
            <Typography color="error" variant="body2">{error}</Typography>
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button variant="text" onClick={onBack}>Back</Button>
        <Button variant="text" onClick={onSkip}>Skip</Button>
      </Stack>
    </Box>
  );
}

function ToolRow({ name, bin, state, installing, onInstall }: {
  name: string;
  bin: string;
  state: ToolState;
  installing: boolean;
  onInstall: () => void;
}) {
  if (state.installed) {
    return (
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CheckCircleIcon color="success" />
        <Typography>{name}</Typography>
        <Chip label={`${bin} ${state.version}`} size="small" color="success" />
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Typography>{name}</Typography>
      <Button
        variant="contained"
        onClick={onInstall}
        disabled={installing}
        startIcon={
          installing ? <CircularProgress size={16} color="inherit" /> : undefined
        }
        disableElevation
        size="small"
        sx={{ minWidth: 120 }}
      >
        {installing ? "Installing..." : "Install"}
      </Button>
    </Stack>
  );
}
