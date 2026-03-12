import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Skeleton,
  Alert,
  Stack,
  LinearProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { SessionRecord, StatsOverview } from "../lib/api";
import { api } from "../lib/api";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function SessionRow({ session }: { session: SessionRecord }) {
  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ flex: 1, mr: 2 }}>
            {session.firstQuery || session.title || session.chatId.slice(0, 8)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            {session.date}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {session.verdict && (
            <Chip
              label={session.verdict}
              size="small"
              color={session.verdict === "productive" ? "success" : "default"}
              variant="outlined"
              sx={{ fontSize: "0.65rem" }}
            />
          )}
          <Chip label={`${session.userTurns} turns`} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
          <Chip label={`${session.totalCalls} calls`} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
          {session.skills.slice(0, 3).map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Insights() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.stats(), api.sessions(0, 15)])
      .then(([s, p]) => {
        setStats(s as StatsOverview);
        setSessions(p.records);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}><Skeleton variant="rounded" height={80} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <TipsAndUpdatesIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Insights</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <StatCard label="Sessions" value={stats.totalSessions} sub={`${stats.analyzedSessions} analyzed`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="Productive" value={`${stats.productiveRate}%`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="Efficiency" value={stats.avgEfficiency} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard label="Streak" value={`${stats.currentStreak}d`} sub={`best: ${stats.bestStreak}d`} />
          </Grid>
        </Grid>
      )}

      {stats && stats.productiveRate > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
            Productive rate
          </Typography>
          <LinearProgress
            variant="determinate"
            value={stats.productiveRate}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Recent Sessions
      </Typography>

      {sessions.length === 0 ? (
        <Alert severity="info">
          No sessions found. Start coding with an AI agent and sessions will appear here automatically.
        </Alert>
      ) : (
        sessions.map((s) => <SessionRow key={s.chatId} session={s} />)
      )}
    </Box>
  );
}
