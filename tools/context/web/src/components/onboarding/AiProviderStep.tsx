import { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ApiKeyForm } from "./ApiKeyForm";

interface Props {
  onComplete: (provider?: string) => void;
  onBack: () => void;
}

type AuthMode = "api-key" | "login";
type ProviderId = "anthropic" | "openai";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI (Codex)" },
] satisfies Array<{ id: ProviderId; label: string }>;

export function AiProviderStep({ onComplete, onBack }: Props) {
  const [provider, setProvider] = useState<ProviderId | "">("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  async function handleLogin(selectedProvider: ProviderId) {
    setSaving(true);
    setError(null);
    try {
      const body = selectedProvider === "anthropic"
        ? { ai_provider: "anthropic", claude_auth_mode: "login" }
        : { ai_provider: "openai", codex_auth_mode: "login" };

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setConnected(true);
      setTimeout(() => onComplete(selectedProvider), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function selectProvider(id: ProviderId) {
    setProvider(id);
    setAuthMode("login");
    setConnected(false);
    setError(null);
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 6, px: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, textTransform: "none" }}>
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Connect your AI provider
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        This stays on your machine. We never see your key.
      </Typography>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {PROVIDERS.map((p) => (
          <Card
            key={p.id}
            variant="outlined"
            sx={{
              borderColor: provider === p.id ? "primary.main" : "divider",
              borderWidth: provider === p.id ? 2 : 1,
              transition: "border-color 0.2s, border-width 0.2s",
            }}
          >
            <CardActionArea onClick={() => selectProvider(p.id)} sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>{p.label}</Typography>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      {provider !== "" && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={authMode === "login" ? "contained" : "outlined"}
              onClick={() => { setAuthMode("login"); setError(null); setConnected(false); }}
              disableElevation
              sx={{ flex: 1, textTransform: "none" }}
            >
              Login
            </Button>
            <Button
              variant={authMode === "api-key" ? "contained" : "outlined"}
              onClick={() => { setAuthMode("api-key"); setError(null); setConnected(false); }}
              disableElevation
              sx={{ flex: 1, textTransform: "none" }}
            >
              API Key
            </Button>
          </Stack>

          {authMode === "login" && (
            <>
              <Typography variant="body2" color="text.secondary">
                {provider === "anthropic"
                  ? "Use your Anthropic account credentials. No API key needed."
                  : "Use your OpenAI / Codex login flow. No API key needed."}
              </Typography>
              {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
              {connected && <Alert severity="success">Login configured</Alert>}
              <Button
                variant="contained"
                onClick={() => handleLogin(provider)}
                disabled={saving || connected}
                disableElevation
                startIcon={saving ? <CircularProgress size={18} /> : undefined}
              >
                {saving ? "Saving..." : "Continue with Login"}
              </Button>
            </>
          )}

          {authMode === "api-key" && (
            <ApiKeyForm
              testProvider={provider === "anthropic" ? "anthropic" : "openai"}
              placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
              saveSettings={(apiKey) => (
                provider === "anthropic"
                  ? {
                      ai_provider: "anthropic",
                      claude_auth_mode: "api_key",
                      anthropic_api_key: apiKey,
                    }
                  : {
                      ai_provider: "openai",
                      openai_api_key: apiKey,
                    }
              )}
              completeProvider={provider}
              onComplete={onComplete}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}
