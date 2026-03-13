import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Skeleton,
  Stack,
  IconButton,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../lib/api";
import { PromptCard } from "../components/PromptCard";

interface HistoryEntry {
  prompt: string;
  response: string;
  ts: number;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function LocalAi() {
  const [status, setStatus] = useState<{ status: string; model: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [maxTokens, setMaxTokens] = useState(200);
  const [temperature, setTemperature] = useState(0.7);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api.localAiStatus());
    } catch {
      setStatus({ status: "offline", model: null });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function send() {
    const text = prompt.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api.localAiPrompt(text, { maxTokens, temperature });
      if (res.ok && res.response) {
        setHistory((h) => [{ prompt: text, response: res.response!, ts: Date.now() }, ...h]);
        setPrompt("");
      }
    } catch { /* best effort */ }
    setSending(false);
  }

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {[1, 2, 3].map((i) => (
            <Grid xs={4} key={i}><Skeleton variant="rounded" height={80} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const online = status?.status === "online";

  return (
    <Box sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Chip
          label={online ? "Online" : "Offline"}
          size="small"
          color={online ? "success" : "error"}
          variant="outlined"
        />
        <Tooltip title="Refresh status">
          <IconButton size="small" onClick={loadStatus}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid xs={6} sm={4}>
          <StatCard label="Status" value={online ? "Running" : "Stopped"} color={online ? "success.main" : "error.main"} />
        </Grid>
        <Grid xs={6} sm={4}>
          <StatCard label="Model" value={status?.model ?? "None"} />
        </Grid>
        <Grid xs={6} sm={4}>
          <StatCard label="Prompts Sent" value={String(history.length)} />
        </Grid>
      </Grid>

      <PromptCard
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={send}
        sending={sending}
        disabled={!online}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        temperature={temperature}
        onTemperatureChange={setTemperature}
      />

      {history.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>History</Typography>
          {history.map((entry, i) => (
            <Card key={i} variant="outlined" sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.ts).toLocaleTimeString()}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                  {entry.prompt}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", color: "text.secondary" }}>
                  {entry.response}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {history.length === 0 && online && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          Send a prompt or click a preset to get started. Zero cost, zero latency.
        </Typography>
      )}
    </Box>
  );
}
