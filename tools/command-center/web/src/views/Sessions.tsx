import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  IconButton,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Card,
  CardContent,
  Skeleton,
  Slider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ScienceIcon from "@mui/icons-material/Science";
import { useSessions } from "../hooks/useSessions";
import { useMqttTopic, useVscodeCommand } from "../hooks/useMqtt";
import { api, type StatsOverview } from "../lib/api";
import { SessionRow } from "../components/SessionRow";
import { Heatmap } from "../components/Heatmap";

export function Sessions() {
  const { page, loading, fetchPage, expandedId, detail, expand } = useSessions();
  const send = useVscodeCommand();
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string | null>(null);
  const [statsLocal, setStatsLocal] = useState<StatsOverview | null>(null);
  const [complexityRange, setComplexityRange] = useState<[number, number]>([0, 0]);
  const [rangeInitialized, setRangeInitialized] = useState(false);

  const mqttStats = useMqttTopic<StatsOverview>("ctx/stats");
  const stats = mqttStats ?? statsLocal;

  const complexityBounds = useMemo(() => {
    const calls = page.records.map((r) => r.totalCalls ?? 0);
    if (calls.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...calls), max: Math.max(...calls) };
  }, [page.records]);

  useEffect(() => {
    if (page.records.length > 0 && !rangeInitialized) {
      setComplexityRange([complexityBounds.min, complexityBounds.max]);
      setRangeInitialized(true);
    }
  }, [page.records.length, complexityBounds, rangeInitialized]);

  useEffect(() => {
    api.stats().then(setStatsLocal).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let records = page.records;
    if (search) {
      const lower = search.toLowerCase();
      records = records.filter(
        (r) =>
          r.title?.toLowerCase().includes(lower) ||
          r.summary?.toLowerCase().includes(lower) ||
          r.firstQuery?.toLowerCase().includes(lower) ||
          r.chatId.toLowerCase().includes(lower),
      );
    }
    if (verdictFilter) {
      records = records.filter((r) => r.verdict === verdictFilter);
    }
    const [lo, hi] = complexityRange;
    if (lo > complexityBounds.min || hi < complexityBounds.max) {
      records = records.filter((r) => {
        const calls = r.totalCalls ?? 0;
        return calls >= lo && calls <= hi;
      });
    }
    return records;
  }, [page.records, search, verdictFilter, complexityRange, complexityBounds]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Sessions</Typography>
        <Chip
          icon={<ScienceIcon />}
          label="Analyze All"
          clickable
          color="primary"
          variant="outlined"
          onClick={() => send("vscode:analyzeAll")}
        />
      </Box>

      {stats?.activityMap && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Activity</Typography>
              <Chip label={`${stats.totalSessions} sessions`} size="small" />
              {stats.currentStreak > 0 && (
                <Chip
                  label={`${stats.currentStreak} day streak`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>
            <Heatmap activityMap={stats.activityMap} />
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          size="small"
          value={verdictFilter}
          exclusive
          onChange={(_, val) => setVerdictFilter(val)}
        >
          <ToggleButton value="productive">Productive</ToggleButton>
          <ToggleButton value="mixed">Mixed</ToggleButton>
          <ToggleButton value="struggling">Struggling</ToggleButton>
        </ToggleButtonGroup>
        {complexityBounds.max > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 220, ml: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              Complexity
            </Typography>
            <Slider
              size="small"
              value={complexityRange}
              min={complexityBounds.min}
              max={complexityBounds.max}
              onChange={(_, val) => setComplexityRange(val as [number, number])}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v} calls`}
              disableSwap
              sx={{ flex: 1 }}
            />
          </Box>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 90, whiteSpace: "nowrap" }}>Verdict</TableCell>
              <TableCell>Session</TableCell>
              <TableCell align="center" sx={{ width: 50, whiteSpace: "nowrap" }}>Turns</TableCell>
              <TableCell align="center" sx={{ width: 50, whiteSpace: "nowrap" }}>Tools</TableCell>
              <TableCell sx={{ width: 100, whiteSpace: "nowrap" }}>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && filtered.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton variant="text" />
                    </TableCell>
                  </TableRow>
                ))
              : filtered.map((record) => (
                  <SessionRow
                    key={record.chatId}
                    record={record}
                    expanded={expandedId === record.chatId}
                    analysis={expandedId === record.chatId ? detail?.analysis ?? null : null}
                    onToggle={() => expand(record.chatId)}
                  />
                ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary">No sessions found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, mt: 2 }}>
        <IconButton
          size="small"
          disabled={page.page <= 0}
          onClick={() => fetchPage(page.page - 1)}
        >
          <NavigateBeforeIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          Page {page.page + 1} of {Math.max(1, page.totalPages)}
        </Typography>
        <IconButton
          size="small"
          disabled={page.page >= page.totalPages - 1}
          onClick={() => fetchPage(page.page + 1)}
        >
          <NavigateNextIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
