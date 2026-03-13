import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Chip,
  LinearProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api } from "../../lib/api";

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
  models: Array<{ name: string; size: number }>;
}

const RECOMMENDED_MODEL = "qwen2.5:0.5b";

export function LocalModelStep({ onComplete, onBack, onSkip }: {
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.ollamaStatus();
      setStatus(s);
    } catch {
      setStatus({ installed: false, running: false, version: null, models: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!status || loading) return;
    if (status.installed && status.running && status.models.length > 0) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, loading, onComplete]);

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      const result = await api.ollamaInstall();
      if (!result.success) {
        setError(result.error ?? "Installation failed");
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setInstalling(false);
  }

  async function handlePull() {
    setPulling(true);
    setError(null);
    try {
      await api.ollamaPull(RECOMMENDED_MODEL);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollama_model: RECOMMENDED_MODEL }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setPulling(false);
  }

  const ready = status?.installed && status.running && status.models.length > 0;

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", px: 3, textAlign: "center" }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Local AI Co-pilot
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        A tiny local model that reacts to workspace events in real time --
        naming sessions, triaging errors, and more. Zero cost, zero latency,
        runs entirely on your machine.
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : ready ? (
        <Stack alignItems="center" spacing={2}>
          <CheckCircleIcon sx={{ fontSize: 64, color: "success.main" }} />
          <Typography variant="h6" color="success.main">Ready</Typography>
          <Chip label={`${status!.models[0].name}`} color="success" />
        </Stack>
      ) : (
        <Stack spacing={3} alignItems="center">
          {!status?.installed && (
            <>
              <Typography variant="body1">
                Ollama is not installed on this machine.
              </Typography>
              <Button
                variant="contained"
                onClick={handleInstall}
                disabled={installing}
                startIcon={installing ? <CircularProgress size={16} color="inherit" /> : undefined}
                disableElevation
                sx={{ minWidth: 200 }}
              >
                {installing ? "Installing..." : "Install Ollama"}
              </Button>
            </>
          )}

          {status?.installed && !status.running && (
            <>
              <Chip label="Installed but not running" color="warning" />
              <Typography variant="body2" color="text.secondary">
                Starting Ollama...
              </Typography>
              <CircularProgress size={24} />
            </>
          )}

          {status?.installed && status.running && status.models.length === 0 && (
            <>
              <Chip label="No models found" color="warning" />
              <Typography variant="body1">
                Download {RECOMMENDED_MODEL} (small, fast)
              </Typography>
              <Button
                variant="contained"
                onClick={handlePull}
                disabled={pulling}
                disableElevation
                sx={{ minWidth: 200 }}
              >
                {pulling ? "Downloading..." : `Download ${RECOMMENDED_MODEL}`}
              </Button>
              {pulling && <LinearProgress sx={{ width: "100%" }} />}
            </>
          )}

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
