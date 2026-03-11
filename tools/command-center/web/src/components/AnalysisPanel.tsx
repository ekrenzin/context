import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Alert,
  Skeleton,
} from "@mui/material";
import { VerdictChip } from "./VerdictChip";
import type { SessionRecord, SessionAnalysis } from "../lib/api";
import { useVscodeCommand } from "../hooks/useMqtt";

interface AnalysisPanelProps {
  record: SessionRecord;
  analysis: SessionAnalysis | null;
  loading?: boolean;
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={600}>{value}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
    </Box>
  );
}

function BulletList({ items, color }: { items: string[]; color?: "success" | "error" | "warning" | "info" }) {
  if (items.length === 0) return null;
  return (
    <List dense disablePadding>
      {items.map((item, i) => (
        <ListItem key={i} disablePadding sx={{ pl: 1 }}>
          <ListItemText
            primary={item}
            primaryTypographyProps={{
              variant: "body2",
              color: color ? `${color}.main` : "text.primary",
            }}
          />
        </ListItem>
      ))}
    </List>
  );
}

export function AnalysisPanel({ record, analysis, loading }: AnalysisPanelProps) {
  const send = useVscodeCommand();

  if (loading) {
    return (
      <Box sx={{ py: 2 }}>
        <Skeleton variant="rounded" height={32} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} lg={4} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!analysis) {
    return (
      <Box sx={{ textAlign: "center", py: 3 }}>
        <Typography color="text.secondary" gutterBottom>
          No analysis available for this session.
        </Typography>
        <Chip
          label="Analyze This Session"
          color="primary"
          clickable
          onClick={() => send({ type: "vscode:analyzeSession", chatId: record.chatId })}
        />
      </Box>
    );
  }

  const effPct = Math.min(Math.max(analysis.efficiency.score, 0), 10) * 10;
  const userMax = Math.max(1, ...Object.values(analysis.userStats));
  const agentMax = Math.max(1, ...Object.values(analysis.agentStats));

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <VerdictChip verdict={analysis.verdict} size="medium" />
        <Typography variant="body1" fontWeight={500} sx={{ flex: 1 }}>
          {analysis.summary}
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ maxWidth: "100%", overflow: "hidden" }}>
        <Grid item xs={12} sm={6} lg={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Efficiency</Typography>
            <Box sx={{ mb: 1 }}>
              <LinearProgress
                variant="determinate"
                value={effPct}
                color={effPct >= 70 ? "success" : effPct >= 40 ? "warning" : "error"}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="h6" sx={{ mt: 0.5 }}>{analysis.efficiency.score}/10</Typography>
            </Box>
            {analysis.efficiency.wastedCycles && (
              <Alert severity="warning" variant="outlined" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{analysis.efficiency.wastedCycles}</Typography>
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} lg={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>User Stats</Typography>
            {Object.entries(analysis.userStats).map(([k, v]) => (
              <StatBar key={k} label={k} value={v} max={userMax} />
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} lg={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Agent Stats</Typography>
            {Object.entries(analysis.agentStats).map(([k, v]) => (
              <StatBar key={k} label={k} value={v} max={agentMax} />
            ))}
          </Paper>
        </Grid>

        {analysis.wins.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Wins</Typography>
              <BulletList items={analysis.wins} color="success" />
            </Paper>
          </Grid>
        )}

        {analysis.errors.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Errors</Typography>
              <BulletList items={analysis.errors} color="error" />
            </Paper>
          </Grid>
        )}

        {analysis.gaps.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Gaps</Typography>
              <BulletList items={analysis.gaps} color="warning" />
            </Paper>
          </Grid>
        )}

        {analysis.insights.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Insights</Typography>
              <BulletList items={analysis.insights} color="info" />
            </Paper>
          </Grid>
        )}

        {analysis.recommendations.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Recommendations</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {analysis.recommendations.map((rec, i) => (
                  <Chip key={i} label={rec} variant="outlined" size="small" />
                ))}
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
