import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import RefreshIcon from "@mui/icons-material/Refresh";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import { api, type StatsOverview, type ProfileData } from "../lib/api";
import { useMqttTopic, useVscodeCommand } from "../hooks/useMqtt";
import { Heatmap } from "../components/Heatmap";

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUpIcon fontSize="small" color="success" />;
  if (direction === "down") return <TrendingDownIcon fontSize="small" color="error" />;
  return <TrendingFlatIcon fontSize="small" color="disabled" />;
}

function StatTile({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | number;
  trend?: { direction: string; delta: number };
}) {
  return (
    <Card>
      <CardContent sx={{ textAlign: "center", py: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {trend && <TrendIcon direction={trend.direction} />}
        </Box>
      </CardContent>
    </Card>
  );
}

function BarChart({
  items,
  color = "primary",
}: {
  items: Array<{ name: string; count: number }>;
  color?: "primary" | "secondary";
}) {
  const max = items.length > 0 ? items[0].count : 1;
  return (
    <Box>
      {items.slice(0, 10).map((item) => (
        <Box key={item.name} sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption">{item.name}</Typography>
            <Typography variant="caption" fontWeight={600}>{item.count}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.round((item.count / max) * 100)}
            color={color}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      ))}
    </Box>
  );
}

export function Analytics() {
  const [statsLocal, setStatsLocal] = useState<StatsOverview | null>(null);
  const [profileLocal, setProfileLocal] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const send = useVscodeCommand();

  const mqttStats = useMqttTopic<StatsOverview>("ctx/stats");
  const mqttProfile = useMqttTopic<ProfileData>("ctx/profile");
  const stats = mqttStats ?? statsLocal;
  const profile = mqttProfile ?? profileLocal;

  useEffect(() => {
    Promise.all([api.stats(), api.profile()])
      .then(([s, p]) => { setStatsLocal(s); setProfileLocal(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Analytics</Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={6} md={2} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Analytics</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh stats">
            <IconButton onClick={() => {
              api.stats().then(setStatsLocal).catch(() => {});
              api.profile().then(setProfileLocal).catch(() => {});
            }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Chip
            label="Run Profile Scan"
            clickable
            variant="outlined"
            onClick={() => send("vscode:profileScan")}
          />
        </Box>
      </Box>

      {stats && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={2}>
              <StatTile label="Sessions" value={stats.totalSessions} />
            </Grid>
            <Grid item xs={6} md={2}>
              <StatTile label="Analyzed" value={stats.analyzedSessions} />
            </Grid>
            <Grid item xs={6} md={2}>
              <StatTile
                label="Productive"
                value={`${stats.productiveRate}%`}
                trend={stats.trends.productiveRate}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <StatTile
                label="Avg Efficiency"
                value={stats.avgEfficiency}
                trend={stats.trends.efficiency}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <StatTile
                label="Tool Calls"
                value={stats.totalToolCalls >= 1000 ? `${(stats.totalToolCalls / 1000).toFixed(1)}k` : stats.totalToolCalls}
                trend={stats.trends.toolCalls}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {stats.currentStreak > 0 && <LocalFireDepartmentIcon color="warning" />}
                    <Typography variant="h4" fontWeight={700}>{stats.currentStreak}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Day Streak (Best: {stats.bestStreak})
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Activity Heatmap
              </Typography>
              <Heatmap activityMap={stats.activityMap} />
            </CardContent>
          </Card>
        </>
      )}

      {profile && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="subtitle2">Top Skills</Typography>
                <Typography variant="caption" color="text.secondary">
                  {profile.sessions} sessions scanned
                </Typography>
              </Box>
              <BarChart items={profile.skills} color="primary" />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Top Tools</Typography>
              <BarChart items={profile.tools} color="secondary" />
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
