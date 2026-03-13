import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  CircularProgress,
  Chip,
  MenuItem,
  Alert,
  Autocomplete,
} from "@mui/material";
import { api } from "../../lib/api";

const POPULAR_MODELS = [
  "qwen2.5:0.5b",
  "qwen2.5:1.5b",
  "qwen2.5:3b",
  "qwen2.5:7b",
  "qwen2.5-coder:1.5b",
  "qwen2.5-coder:7b",
  "llama3.2:1b",
  "llama3.2:3b",
  "llama3.1:8b",
  "gemma3:1b",
  "gemma3:4b",
  "gemma2:2b",
  "gemma2:9b",
  "phi4-mini",
  "phi3:mini",
  "mistral",
  "deepseek-r1:1.5b",
  "deepseek-r1:7b",
  "deepseek-coder-v2:16b",
  "codellama:7b",
  "nomic-embed-text",
];

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
  models: Array<{ name: string; size: number }>;
}

export function OllamaCard({ selectedModel, onModelChange }: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pullName, setPullName] = useState("qwen2.5:0.5b");
  const [pulling, setPulling] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; severity: "success" | "error" | "info" } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const s = await api.ollamaStatus();
      setStatus(s);
    } catch {
      setMessage({ text: "Could not reach server to check Ollama status", severity: "error" });
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleInstall() {
    setInstalling(true);
    setMessage({ text: "Installing Ollama (this may take a minute)...", severity: "info" });
    try {
      const result = await api.ollamaInstall();
      if (result.success) {
        setMessage({ text: "Ollama installed successfully", severity: "success" });
        await refresh();
      } else {
        setMessage({ text: `Installation failed: ${result.error ?? "unknown error"}`, severity: "error" });
      }
    } catch (err) {
      setMessage({ text: `Installation failed: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
    }
    setInstalling(false);
  }

  async function handlePull() {
    if (!pullName.trim()) return;
    setPulling(true);
    setMessage({ text: `Pulling ${pullName.trim()}...`, severity: "info" });
    try {
      await api.ollamaPull(pullName.trim());
      setMessage({ text: `Model ${pullName.trim()} pulled successfully`, severity: "success" });
      await refresh();
    } catch (err) {
      setMessage({ text: `Pull failed: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
    }
    setPulling(false);
  }

  async function handleTest() {
    const model = selectedModel || status?.models[0]?.name;
    if (!model) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.ollamaTest(model);
      setTestResult(r.result ?? "No response");
      setTestLatency(r.latency ?? null);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setTestLatency(null);
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack alignItems="center" py={2}><CircularProgress size={24} /></Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Local Model (Ollama)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Used for generating creative terminal session names. Optional.
        </Typography>

        <Stack spacing={2}>
          {message && (
            <Alert
              severity={message.severity}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Status:</Typography>
            {!status?.installed ? (
              <Chip label="Not installed" color="default" size="small" />
            ) : !status.running ? (
              <Chip label="Installed (not running)" color="warning" size="small" />
            ) : (
              <Chip label={`Running v${status.version ?? "?"}`} color="success" size="small" />
            )}
          </Stack>

          {!status?.installed && (
            <Button
              variant="outlined"
              onClick={handleInstall}
              disabled={installing}
              startIcon={installing ? <CircularProgress size={16} /> : undefined}
            >
              {installing ? "Installing..." : "Install Ollama"}
            </Button>
          )}

          {status?.installed && status.models.length > 0 && (
            <TextField
              select
              label="Model"
              value={selectedModel || ""}
              onChange={(e) => onModelChange(e.target.value)}
              size="small"
            >
              {status.models.map((m) => (
                <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>
              ))}
            </TextField>
          )}

          {status?.installed && (
            <Stack direction="row" spacing={1}>
              <Autocomplete
                freeSolo
                options={POPULAR_MODELS}
                value={pullName}
                onInputChange={(_e, value) => setPullName(value)}
                size="small"
                sx={{ flex: 1 }}
                renderInput={(params) => (
                  <TextField {...params} label="Pull model" />
                )}
              />
              <Button
                variant="outlined"
                onClick={handlePull}
                disabled={pulling || !pullName.trim()}
                sx={{ minWidth: 80 }}
              >
                {pulling ? <CircularProgress size={16} /> : "Pull"}
              </Button>
            </Stack>
          )}

          {status?.running && status.models.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                onClick={handleTest}
                disabled={testing}
                sx={{ minWidth: 80 }}
              >
                {testing ? <CircularProgress size={16} /> : "Test"}
              </Button>
              {testResult && (
                <Typography variant="body2" color="text.secondary">
                  "{testResult}"{testLatency != null ? ` (${testLatency}ms)` : ""}
                </Typography>
              )}
            </Stack>
          )}

          {testResult?.startsWith("Error") && !message && (
            <Alert severity="error" onClose={() => setTestResult(null)}>{testResult}</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
