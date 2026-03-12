import { useState } from "react";
import {
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  IconButton,
  InputAdornment,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

interface Props {
  provider: string;
  placeholder: string;
  onComplete: (provider: string) => void;
}

export function ApiKeyForm({ provider, placeholder, onComplete }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function handleTest() {
    if (!apiKey.trim()) return;
    setTesting(true);
    setError(null);
    setConnected(false);

    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });

      const text = await res.text();
      if (!text) {
        setError("Empty response from server -- is the backend running?");
        return;
      }

      let data: { ok: boolean; model?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Server error (${res.status}): ${text.slice(0, 200)}`);
        return;
      }

      if (!data.ok) {
        setError(data.error ?? "Connection failed");
        return;
      }

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_provider: provider,
          [`${provider}_api_key`]: apiKey.trim(),
        }),
      });

      setConnected(true);
      setTimeout(() => onComplete(provider), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="API Key"
        type={showKey ? "text" : "password"}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        fullWidth
        placeholder={placeholder}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle key visibility"
                  onClick={() => setShowKey((v) => !v)}
                  edge="end"
                  size="small"
                >
                  {showKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {connected && <Alert severity="success">Connected</Alert>}
      <Button
        variant="contained"
        onClick={handleTest}
        disabled={!apiKey.trim() || testing || connected}
        disableElevation
        startIcon={testing ? <CircularProgress size={18} /> : undefined}
      >
        {testing ? "Testing..." : "Test Connection"}
      </Button>
    </Stack>
  );
}
