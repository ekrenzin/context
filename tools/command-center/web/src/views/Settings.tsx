import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  IconButton,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { OllamaCard } from "../components/settings/OllamaCard";

interface SettingsData {
  ai_provider?: string;
  claude_auth_mode?: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
  github_token?: string;
  profiler_mode?: string;
  ollama_model?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  async function save() {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function testKey(provider: "anthropic" | "openai") {
    const key = provider === "anthropic"
      ? settings.anthropic_api_key
      : settings.openai_api_key;
    if (!key) return;

    setTesting(provider);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });

      const text = await res.text();
      if (!text) {
        setTestResult("Error: empty response from server");
        return;
      }

      let data: { ok: boolean; model?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setTestResult(`Error: server returned non-JSON (${res.status})`);
        return;
      }

      setTestResult(data.ok ? `Connected: ${data.model}` : `Failed: ${data.error}`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(null);
    }
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", pt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <SettingsIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Saved</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {testResult && (
        <Alert
          severity={testResult.startsWith("Connected") ? "success" : "error"}
          sx={{ mb: 2 }}
          onClose={() => setTestResult(null)}
        >
          {testResult}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>AI Provider</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Claude authentication method
              </Typography>
              <ToggleButtonGroup
                value={settings.claude_auth_mode ?? "login"}
                exclusive
                onChange={(_, v) => { if (v) update("claude_auth_mode", v); }}
                size="small"
                fullWidth
              >
                <ToggleButton value="login">Login Flow</ToggleButton>
                <ToggleButton value="api_key">API Key</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {settings.claude_auth_mode === "api_key"
                  ? "Authenticate with an Anthropic API key (ANTHROPIC_API_KEY)."
                  : "Authenticate via Claude browser login (OAuth)."}
              </Typography>
            </Box>
            {settings.claude_auth_mode === "api_key" && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                <TextField
                  fullWidth
                  label="Anthropic API Key"
                  type={visible.anthropic ? "text" : "password"}
                  value={settings.anthropic_api_key ?? ""}
                  onChange={(e) => update("anthropic_api_key", e.target.value)}
                  placeholder="sk-ant-..."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle Anthropic key visibility"
                            onClick={() => setVisible((v) => ({ ...v, anthropic: !v.anthropic }))}
                            edge="end"
                            size="small"
                          >
                            {visible.anthropic ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!settings.anthropic_api_key || testing === "anthropic"}
                  onClick={() => testKey("anthropic")}
                  sx={{ minWidth: 80, height: 56 }}
                >
                  {testing === "anthropic" ? <CircularProgress size={20} /> : "Test"}
                </Button>
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
              <TextField
                fullWidth
                label="OpenAI API Key"
                type={visible.openai ? "text" : "password"}
                value={settings.openai_api_key ?? ""}
                onChange={(e) => update("openai_api_key", e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle OpenAI key visibility"
                          onClick={() => setVisible((v) => ({ ...v, openai: !v.openai }))}
                          edge="end"
                          size="small"
                        >
                          {visible.openai ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={!settings.openai_api_key || testing === "openai"}
                onClick={() => testKey("openai")}
                sx={{ minWidth: 80, height: 56 }}
              >
                {testing === "openai" ? <CircularProgress size={20} /> : "Test"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>GitHub</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Personal access token with repo scope. Used to create and push your workspace repository.
          </Typography>
          <TextField
            fullWidth
            label="GitHub Personal Access Token"
            type={visible.github ? "text" : "password"}
            value={settings.github_token ?? ""}
            onChange={(e) => update("github_token", e.target.value)}
            placeholder="ghp_..."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle GitHub token visibility"
                      onClick={() => setVisible((v) => ({ ...v, github: !v.github }))}
                      edge="end"
                      size="small"
                    >
                      {visible.github ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Profiler Mode</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Auto-apply writes improvements directly. Suggest-only flags them for review.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant={settings.profiler_mode === "auto" ? "contained" : "outlined"}
              onClick={() => update("profiler_mode", "auto")}
              disableElevation
            >
              Auto-apply
            </Button>
            <Button
              variant={settings.profiler_mode !== "auto" ? "contained" : "outlined"}
              onClick={() => update("profiler_mode", "suggest")}
              disableElevation
            >
              Suggest only
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <OllamaCard
        selectedModel={settings.ollama_model ?? ""}
        onModelChange={(model) => update("ollama_model", model)}
      />

      <Button variant="contained" fullWidth onClick={save} disableElevation>
        Save Settings
      </Button>
    </Box>
  );
}
