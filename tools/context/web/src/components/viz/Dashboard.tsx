import { useState, useEffect, useCallback } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Skeleton,
  LinearProgress,
  Box,
  Alert,
  useTheme,
} from "@mui/material";
import type { SessionRecord, StatsOverview } from "../../lib/api";
import { api } from "../../lib/api";
import ActivityHeatmap from "./ActivityHeatmap";
import TopItemsChart from "./TopItemsChart";
import ProductivityTrend from "./ProductivityTrend";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function buildSkillData(
  sessions: SessionRecord[],
): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const sk of s.skills) {
      counts.set(sk, (counts.get(sk) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

function buildToolData(
  sessions: SessionRecord[],
): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const [tool, n] of Object.entries(s.tools)) {
      counts.set(tool, (counts.get(tool) ?? 0) + n);
    }
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

interface Props {
  generation: number;
}

export default function Dashboard({ generation }: Props) {
  const theme = useTheme();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.stats(), api.sessions(0, 100)])
      .then(([s, p]) => {
        setStats(s as StatsOverview);
        setSessions(p.records);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, generation]);

  if (loading && !stats) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid xs={6} sm={3} key={i}>
            <Skeleton variant="rounded" height={80} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!stats) {
    return <Alert severity="info">No stats available yet.</Alert>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Grid container spacing={2}>
        <Grid xs={6} sm={3}>
          <StatCard
            label="Sessions"
            value={stats.totalSessions}
            sub={`${stats.analyzedSessions} analyzed`}
          />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard label="Productive" value={`${stats.productiveRate}%`} />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard label="Efficiency" value={stats.avgEfficiency} />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard
            label="Streak"
            value={`${stats.currentStreak}d`}
            sub={`best: ${stats.bestStreak}d`}
          />
        </Grid>
      </Grid>

      {stats.productiveRate > 0 && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5, display: "block" }}
          >
            Productive rate
          </Typography>
          <LinearProgress
            variant="determinate"
            value={stats.productiveRate}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      <ActivityHeatmap activityMap={stats.activityMap} />

      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <TopItemsChart title="Top Skills" data={buildSkillData(sessions)} />
        </Grid>
        <Grid xs={12} md={6}>
          <TopItemsChart
            title="Top Tools"
            data={buildToolData(sessions)}
            color={theme.palette.warning.main}
          />
        </Grid>
      </Grid>

      <ProductivityTrend sessions={sessions} />
    </Box>
  );
}
