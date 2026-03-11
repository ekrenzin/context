import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  Drawer,
  IconButton,
  Divider,
  Skeleton,
  Alert,
  Stack,
  Tooltip,
  Button,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { MarkdownContent } from "../components/MarkdownContent";
import { ActiveRunBanner, RunProgressBar } from "../components/IntelProgress";
import { NewAnalysisDialog } from "../components/NewAnalysisDialog";
import CloseIcon from "@mui/icons-material/Close";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ArticleIcon from "@mui/icons-material/Article";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import type {
  IntelRun,
  IntelReport,
  IntelReportType,
  IntelRunPhase,
  AgentJob,
} from "../lib/api";
import { api } from "../lib/api";
import { useMqttTopic } from "../hooks/useMqtt";

const TYPE_META: Record<
  IntelReportType,
  { label: string; color: "primary" | "secondary" | "success" | "info" | "warning" | "error" | "default" }
> = {
  "product-analysis": { label: "Product Analysis", color: "primary" },
  "competitor-search": { label: "Competitor Search", color: "secondary" },
  "competitor-deepdive": { label: "Deep Dive", color: "info" },
  "industry-leaders": { label: "Industry Leaders", color: "success" },
  "news-scan": { label: "News Scan", color: "warning" },
  "article-analysis": { label: "Article", color: "default" },
  "competitive-suggestions": { label: "Suggestions", color: "error" },
  "demo-sales": { label: "Demo & Sales", color: "success" },
  "market-analysis": { label: "Market Analysis", color: "secondary" },
};

function formatBytes(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function RunCard({ run, onClick }: { run: IntelRun; onClick: () => void }) {
  const isActive = !run.complete && run.progress != null;
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        ...(isActive && {
          borderColor: "warning.main",
          borderWidth: 1.5,
        }),
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            {run.complete ? (
              <CheckCircleIcon fontSize="small" color="success" />
            ) : (
              <HourglassEmptyIcon
                fontSize="small"
                color="warning"
                sx={isActive ? {
                  animation: "spin 2s linear infinite",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                } : undefined}
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
              {run.date}
            </Typography>
          </Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
            {run.repo}{run.focus ? ` -- ${run.focus}` : ""}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
            <Chip label={run.depth} size="small" variant="outlined" sx={{ fontSize: "0.6rem" }} />
            <Chip
              label={`${run.phases.length} phases`}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.6rem" }}
            />
          </Stack>
          {isActive && run.progress ? (
            <RunProgressBar progress={run.progress} />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {formatBytes(run.totalBytes)}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function LegacyCard({ report, onClick }: { report: IntelReport; onClick: () => void }) {
  const meta = TYPE_META[report.type] ?? { label: report.type, color: "default" as const };
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Chip label={meta.label} size="small" color={meta.color} variant="outlined" sx={{ fontSize: "0.65rem" }} />
            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
              {report.date}
            </Typography>
          </Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
            {report.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatBytes(report.sizeBytes)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

type DrawerTarget =
  | { kind: "run"; run: IntelRun }
  | { kind: "legacy"; report: IntelReport };

function PhaseNav({
  phases,
  activePhase,
  onSelect,
}: {
  phases: IntelRunPhase[];
  activePhase: string | null;
  onSelect: (filename: string | null) => void;
}) {
  return (
    <List dense disablePadding sx={{ mb: 1 }}>
      <ListItemButton
        selected={activePhase === null}
        onClick={() => onSelect(null)}
        sx={{ borderRadius: 1, py: 0.25 }}
      >
        <ListItemText
          primary="Full Report"
          primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
        />
      </ListItemButton>
      {phases.map((p) => {
        const meta = TYPE_META[p.type];
        return (
          <ListItemButton
            key={p.filename}
            selected={activePhase === p.filename}
            onClick={() => onSelect(p.filename)}
            sx={{ borderRadius: 1, py: 0.25 }}
          >
            <ListItemText
              primary={p.title}
              secondary={meta?.label}
              primaryTypographyProps={{ variant: "body2" }}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function Intel() {
  const [runs, setRuns] = useState<IntelRun[]>([]);
  const [legacy, setLegacy] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null);
  const [drawerContent, setDrawerContent] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const mqttIntel = useMqttTopic<{ ts: string }>("ctx/intel");
  const mqttAgents = useMqttTopic<{ jobs?: AgentJob[] }>("ctx/agents");
  const intelJobs = (mqttAgents?.jobs ?? []).filter((j) => j.type === "intel-analysis");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(() => {
    api
      .intelList()
      .then((data) => {
        setRuns(data.runs);
        setLegacy(data.legacyReports);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (mqttIntel) loadData();
  }, [mqttIntel, loadData]);

  const hasActiveRuns = runs.some((r) => !r.complete && r.progress != null);

  useEffect(() => {
    if (hasActiveRuns) {
      pollRef.current = setInterval(loadData, 4000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasActiveRuns, loadData]);

  function openRun(run: IntelRun) {
    setDrawerTarget({ kind: "run", run });
    setActivePhase(null);
    loadRunContent(run.id, null);
  }

  function openLegacy(report: IntelReport) {
    setDrawerTarget({ kind: "legacy", report });
    setActivePhase(null);
    setDrawerLoading(true);
    setDrawerContent(null);
    api
      .intelLegacyContent(report.filename)
      .then((d) => setDrawerContent(d.content))
      .catch(() => setDrawerContent("Failed to load report."))
      .finally(() => setDrawerLoading(false));
  }

  function loadRunContent(runId: string, phase: string | null) {
    setDrawerLoading(true);
    setDrawerContent(null);
    const promise = phase
      ? api.intelRunPhaseContent(runId, phase)
      : api.intelRunContent(runId);
    promise
      .then((d) => setDrawerContent(d.content ?? ""))
      .catch(() => setDrawerContent(null))
      .finally(() => setDrawerLoading(false));
  }

  function selectPhase(filename: string | null) {
    setActivePhase(filename);
    if (drawerTarget?.kind === "run") {
      loadRunContent(drawerTarget.run.id, filename);
    }
  }

  function closeDrawer() {
    setDrawerTarget(null);
    setDrawerContent(null);
    setActivePhase(null);
  }

  const totalCount = runs.length + legacy.length;

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
        <TravelExploreIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Competitive Intel
        </Typography>
        <Chip size="small" label={`${totalCount} reports`} variant="outlined" />
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadData}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<TravelExploreIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New Analysis
          </Button>
        </Box>
      </Box>

      {runs.filter((r) => !r.complete && r.progress).map((r) => {
        const job = intelJobs.find(
          (j) => j.status === "running" && j.detail?.startsWith(r.repo),
        );
        return (
          <ActiveRunBanner
            key={r.id}
            run={r}
            logTail={job?.logTail}
            onClick={() => openRun(r)}
            onCancel={
              job
                ? () => { api.cancelJob(job.id).then(loadData).catch(() => {}); }
                : undefined
            }
          />
        );
      })}

      {runs.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
            Analysis Runs
          </Typography>
          <Grid container spacing={2}>
            {runs.map((run) => (
              <Grid item xs={12} sm={6} md={4} key={run.id}>
                <RunCard run={run} onClick={() => openRun(run)} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {legacy.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
            {runs.length > 0 ? "Legacy Reports" : "Reports"}
          </Typography>
          <Grid container spacing={2}>
            {legacy.map((report) => (
              <Grid item xs={12} sm={6} md={4} key={report.filename}>
                <LegacyCard report={report} onClick={() => openLegacy(report)} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {totalCount === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No competitive intel reports found. Run a competitive analysis from a
          Cursor chat using the <strong>/competitive-intel</strong> skill to
          generate reports.
        </Alert>
      )}

      <Drawer
        anchor="right"
        open={drawerTarget !== null}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: "100%", md: 720 }, p: 0, top: 64, height: "calc(100% - 64px)" } }}
      >
        {drawerTarget && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 2, pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ArticleIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  {drawerTarget.kind === "run"
                    ? `${drawerTarget.run.repo}${drawerTarget.run.focus ? ` -- ${drawerTarget.run.focus}` : ""}`
                    : drawerTarget.report.title}
                </Typography>
              </Box>
              <IconButton size="small" onClick={closeDrawer}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ px: 2.5, pb: 1 }}>
              {drawerTarget.kind === "run" ? (
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  <Chip label={drawerTarget.run.date} size="small" variant="outlined" />
                  <Chip label={drawerTarget.run.depth} size="small" variant="outlined" />
                  <Chip
                    label={drawerTarget.run.complete ? "Complete" : "In Progress"}
                    size="small"
                    color={drawerTarget.run.complete ? "success" : "warning"}
                    variant="outlined"
                  />
                  {!drawerTarget.run.complete && drawerTarget.run.progress && (
                    <Chip
                      label={`${drawerTarget.run.progress.completedPhases}/${drawerTarget.run.progress.expectedPhases} phases -- ${drawerTarget.run.progress.currentLabel ?? "Starting..."}`}
                      size="small"
                      color="warning"
                      variant="filled"
                    />
                  )}
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5}>
                  <Chip
                    label={TYPE_META[drawerTarget.report.type]?.label ?? drawerTarget.report.type}
                    size="small"
                    color={TYPE_META[drawerTarget.report.type]?.color ?? "default"}
                    variant="outlined"
                  />
                  <Chip label={drawerTarget.report.date} size="small" variant="outlined" />
                </Stack>
              )}
            </Box>

            <Divider />

            <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {drawerTarget.kind === "run" && drawerTarget.run.phases.length > 1 && (
                <Box sx={{ width: 200, borderRight: 1, borderColor: "divider", overflow: "auto", py: 1, px: 1 }}>
                  <PhaseNav
                    phases={drawerTarget.run.phases}
                    activePhase={activePhase}
                    onSelect={selectPhase}
                  />
                </Box>
              )}
              <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
                {drawerLoading ? (
                  <Box>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} variant="text" sx={{ mb: 0.5 }} />
                    ))}
                  </Box>
                ) : drawerContent === null ? (
                  <Alert severity="error">Failed to load report.</Alert>
                ) : drawerContent.length > 0 ? (
                  <MarkdownContent content={drawerContent} />
                ) : drawerTarget.kind === "run" && !drawerTarget.run.complete ? (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <HourglassEmptyIcon
                      sx={{
                        fontSize: 48,
                        color: "text.disabled",
                        mb: 2,
                        animation: "spin 2s linear infinite",
                        "@keyframes spin": {
                          "0%": { transform: "rotate(0deg)" },
                          "100%": { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Analysis in progress
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      No phases have completed yet. Results will appear here as each phase finishes.
                    </Typography>
                  </Box>
                ) : (
                  <Alert severity="info">No content available for this report.</Alert>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      <NewAnalysisDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={loadData}
      />
    </Box>
  );
}
