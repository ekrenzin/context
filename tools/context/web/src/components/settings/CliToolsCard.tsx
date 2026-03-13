import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  CircularProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import { api } from "../../lib/api";

interface ToolState {
  installed: boolean;
  version: string | null;
}

export function CliToolsCard() {
  const [claude, setClaude] = useState<ToolState | null>(null);
  const [codex, setCodex] = useState<ToolState | null>(null);
  const [cloudflared, setCloudflared] = useState<ToolState | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.cliToolsStatus();
      setClaude(s.claude);
      setCodex(s.codex);
      setCloudflared(s.cloudflared);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function install(tool: "claude" | "codex" | "cloudflared") {
    setInstalling(tool);
    setError(null);
    try {
      const result = await api.cliToolsInstall(tool);
      if (!result.success) {
        setError(result.error ?? `Failed to install ${tool}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setInstalling(null);
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>AI Coding CLIs</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Command-line AI coding assistants installed globally via npm.
        </Typography>

        <Stack spacing={1.5}>
          <ToolLine
            name="Claude Code"
            bin="claude"
            pkg="@anthropic-ai/claude-code"
            state={claude}
            installing={installing === "claude"}
            onInstall={() => install("claude")}
          />
          <ToolLine
            name="Codex"
            bin="codex"
            pkg="@openai/codex"
            state={codex}
            installing={installing === "codex"}
            onInstall={() => install("codex")}
          />
          <ToolLine
            name="Cloudflared"
            bin="cloudflared"
            pkg="cloudflare/cloudflared"
            state={cloudflared}
            installing={installing === "cloudflared"}
            onInstall={() => install("cloudflared")}
          />
        </Stack>

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function ToolLine({ name, bin, pkg, state, installing, onInstall }: {
  name: string;
  bin: string;
  pkg: string;
  state: ToolState | null;
  installing: boolean;
  onInstall: () => void;
}) {
  if (!state) {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <CircularProgress size={16} />
        <Typography variant="body2">{name}</Typography>
      </Stack>
    );
  }

  if (state.installed) {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="body2">{name}</Typography>
        <Chip label={`${bin} ${state.version}`} size="small" color="success" />
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <WarningIcon color="warning" fontSize="small" />
      <Typography variant="body2">{name}</Typography>
      <Typography variant="caption" color="text.secondary">({pkg})</Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={onInstall}
        disabled={installing}
        startIcon={
          installing ? <CircularProgress size={14} color="inherit" /> : undefined
        }
        sx={{ ml: "auto" }}
      >
        {installing ? "Installing..." : "Install"}
      </Button>
    </Stack>
  );
}
