import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Skeleton,
  Stack,
  Button,
  Tooltip,
  IconButton,
  Collapse,
  LinearProgress,
  useTheme,
  alpha,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PsychologyIcon from "@mui/icons-material/Psychology";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useProject } from "../hooks/useProject";
import { LaunchButtons } from "../components/LaunchButtons";
import { useBranding } from "../lib/branding";
import {
  api,
  type FeedEvent,
  type ApprovalRecord,
  type IntelItem,
} from "../lib/api";

const EVENT_VERBS: Record<string, string> = {
  session_analyzed: "Studied a coding session",
  skill_proposed: "Discovered a repeatable pattern",
  memory_written: "Committed something to memory",
  pattern_detected: "Noticed a recurring pattern",
  approval_resolved: "Resolved a proposal",
  workspace_synced: "Synced workspace intelligence",
};

const EVENT_COLORS: Record<string, "success" | "secondary" | "info" | "warning" | "primary"> = {
  session_analyzed: "primary",
  skill_proposed: "secondary",
  memory_written: "success",
  pattern_detected: "info",
  approval_resolved: "warning",
  workspace_synced: "primary",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function IntelligenceSummary({
  rules,
  skills,
  feed,
  loading,
}: {
  rules: IntelItem[];
  skills: IntelItem[];
  feed: FeedEvent[];
  loading: boolean;
}) {
  const theme = useTheme();
  const branding = useBranding();
  const gradient = branding.useGradient ? branding.accentGradient : undefined;
  const total = rules.length + skills.length;
  const sessionsAnalyzed = feed.filter((e) => e.type === "session_analyzed").length;

  if (loading) {
    return <Skeleton variant="rounded" height={100} sx={{ mb: 3 }} />;
  }

  const hasIntelligence = total > 0 || feed.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 3,
        background: gradient
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
          : alpha(theme.palette.primary.main, 0.04),
        borderColor: alpha(theme.palette.primary.main, 0.15),
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <PsychologyIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            {hasIntelligence ? "Intelligence" : "Awakening"}
          </Typography>
        </Stack>

        {!hasIntelligence ? (
          <Typography variant="body2" color="text.secondary">
            This project is just getting started. As you work, the system will
            analyze your sessions, detect patterns, and build rules and skills
            that capture your team's knowledge.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {total === 0
                ? `Analyzing sessions and looking for patterns.`
                : `Learned ${rules.length} rule${rules.length !== 1 ? "s" : ""} and ${skills.length} skill${skills.length !== 1 ? "s" : ""} so far.`}
              {sessionsAnalyzed > 0 &&
                ` Studied ${sessionsAnalyzed} recent session${sessionsAnalyzed !== 1 ? "s" : ""}.`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, total * 8)}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KnowledgeCard({ item }: { item: IntelItem }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 1,
        px: 1.5,
        mb: 0.5,
        borderRadius: 1,
        cursor: item.content ? "pointer" : "default",
        transition: "background 0.15s",
        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
      onClick={() => item.content && setOpen((p) => !p)}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <FiberManualRecordIcon
          sx={{ fontSize: 8, mt: 0.9, color: "primary.main", flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>
            {item.name}
          </Typography>
          {item.description && (
            <Typography variant="caption" color="text.secondary">
              {item.description}
            </Typography>
          )}
        </Box>
        {item.content && (
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              color: "text.secondary",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
              mt: 0.25,
            }}
          />
        )}
      </Stack>
      <Collapse in={open}>
        <Box
          sx={{
            mt: 1,
            ml: 2,
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontSize: "0.75rem",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {item.content}
          </pre>
        </Box>
      </Collapse>
    </Box>
  );
}

function LearningTimeline({ events }: { events: FeedEvent[] }) {
  const theme = useTheme();

  return (
    <Box>
      {events.map((e, i) => {
        const color = EVENT_COLORS[e.type] ?? "primary";
        const verb = EVENT_VERBS[e.type] ?? e.type.replace(/_/g, " ");

        return (
          <Stack key={e.id} direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            {/* Timeline line + dot */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 20,
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: `${color}.main`,
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              {i < events.length - 1 && (
                <Box
                  sx={{
                    width: 1.5,
                    flex: 1,
                    bgcolor: alpha(theme.palette.divider, 0.5),
                    mt: 0.5,
                  }}
                />
              )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, pb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {e.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {verb} &middot; {timeAgo(e.created_at)}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Box>
  );
}

function ProposalCard({
  approval,
  projectId,
  onResolve,
}: {
  approval: ApprovalRecord;
  projectId: string;
  onResolve: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  let diff: Record<string, unknown> = {};
  try { diff = JSON.parse(approval.diff); } catch { /* empty */ }
  const hasDiff = Object.keys(diff).length > 0;

  async function handle(action: "approve" | "reject") {
    setActing(true);
    try {
      if (action === "approve") await api.approveApproval(projectId, approval.id);
      else await api.rejectApproval(projectId, approval.id);
      onResolve();
    } finally {
      setActing(false);
    }
  }

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        borderColor: alpha(theme.palette.warning.main, 0.25),
        borderLeft: `3px solid ${theme.palette.warning.main}`,
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="body2" fontWeight={600}>{approval.title}</Typography>
        {approval.summary && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {approval.summary}
          </Typography>
        )}

        {hasDiff && (
          <>
            <Button
              size="small"
              sx={{ mt: 0.5, p: 0, minWidth: 0, textTransform: "none", fontSize: "0.75rem" }}
              onClick={() => setExpanded((p) => !p)}
              endIcon={expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            >
              {expanded ? "Hide details" : "Show details"}
            </Button>
            <Collapse in={expanded}>
              <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: "0.75rem" }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(diff, null, 2)}
                </pre>
              </Box>
            </Collapse>
          </>
        )}

        {approval.status === "pending" && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              disabled={acting}
              onClick={() => handle("approve")}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={acting}
              onClick={() => handle("reject")}
            >
              Reject
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProjectDashboard() {
  const { project, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [rules, setRules] = useState<IntelItem[]>([]);
  const [skills, setSkills] = useState<IntelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!project) return;
    setLoading(true);
    Promise.all([
      api.listFeed(project.id, { limit: 10 }),
      api.listApprovals(project.id),
      api.listRules(project.id),
      api.listSkills(project.id),
    ])
      .then(([f, a, r, s]) => {
        setFeed(f);
        setApprovals(a);
        setRules(r);
        setSkills(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project]);

  useEffect(() => { load(); }, [load]);

  if (projectLoading || !project) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rounded" height={100} sx={{ mt: 2 }} />
        <Skeleton variant="rounded" height={200} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <Typography variant="h5" fontWeight={700}>{project.name}</Typography>
        <Chip label={project.status} size="small" color="success" variant="outlined" />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <LaunchButtons projectId={project.id} />
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
        <Tooltip title="Copy path">
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(project.root_path)}
          >
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
          {project.root_path}
        </Typography>
      </Stack>

      {project.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {project.description}
        </Typography>
      )}

      {/* Intelligence summary -- the "brain" */}
      <IntelligenceSummary rules={rules} skills={skills} feed={feed} loading={loading} />

      {/* Proposals -- system asking for permission to grow */}
      {!loading && approvals.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <TipsAndUpdatesIcon fontSize="small" color="warning" />
            <Typography variant="subtitle1" fontWeight={600}>
              Proposals
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The system wants to evolve
            </Typography>
          </Stack>
          {approvals.slice(0, 5).map((a) => (
            <ProposalCard
              key={a.id}
              approval={a}
              projectId={project.id}
              onResolve={load}
            />
          ))}
          {approvals.length > 5 && (
            <Button
              size="small"
              onClick={() => navigate(`/projects/${project.id}/approvals`)}
            >
              {approvals.length - 5} more proposals
            </Button>
          )}
        </Box>
      )}

      {/* Knowledge + Learning -- two-column layout */}
      <Grid container spacing={3}>
        {/* Knowledge: rules + skills */}
        <Grid xs={12} md={7}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <AutoStoriesIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>Knowledge</Typography>
          </Stack>

          {loading ? (
            <Skeleton variant="rounded" height={120} />
          ) : rules.length === 0 && skills.length === 0 ? (
            <Card variant="outlined" sx={{ opacity: 0.7 }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  No knowledge captured yet. The system builds rules and skills
                  as it studies your coding sessions and detects patterns.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {rules.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ pl: 1.5, letterSpacing: 1 }}>
                    Rules ({rules.length})
                  </Typography>
                  {rules.map((r) => <KnowledgeCard key={r.name} item={r} />)}
                </Box>
              )}
              {skills.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ pl: 1.5, letterSpacing: 1 }}>
                    Skills ({skills.length})
                  </Typography>
                  {skills.map((s) => <KnowledgeCard key={s.name} item={s} />)}
                </Box>
              )}
            </>
          )}
        </Grid>

        {/* Learning timeline */}
        <Grid xs={12} md={5}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <PsychologyIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>Learning</Typography>
            <Box sx={{ flex: 1 }} />
            {feed.length > 0 && (
              <Button
                size="small"
                onClick={() => navigate(`/projects/${project.id}/feed`)}
              >
                Full history
              </Button>
            )}
          </Stack>

          {loading ? (
            <Skeleton variant="rounded" height={120} />
          ) : feed.length === 0 ? (
            <Card variant="outlined" sx={{ opacity: 0.7 }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  No learning activity yet. Start a coding session and the
                  system will begin analyzing and learning.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <LearningTimeline events={feed} />
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
