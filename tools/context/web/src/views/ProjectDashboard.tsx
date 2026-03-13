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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import GavelIcon from "@mui/icons-material/Gavel";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { useProject } from "../hooks/useProject";
import { LaunchButtons } from "../components/LaunchButtons";
import { FileBrowser } from "../components/FileBrowser";
import { AiActionsCard } from "../components/AiActionsCard";
import {
  api,
  type FeedEvent,
  type ApprovalRecord,
  type IntelItem,
} from "../lib/api";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700}>{value}</Typography>
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
      api.listFeed(project.id, { limit: 5 }),
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
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid xs={6} sm={3} key={i}><Skeleton variant="rounded" height={80} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{project.name}</Typography>
        <Chip label={project.status} size="small" color="success" variant="outlined" />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <LaunchButtons projectId={project.id} />
      </Stack>

      {project.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {project.description}
        </Typography>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid xs={6} sm={3}>
          <StatCard label="Rules" value={loading ? "..." : rules.length} />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard label="Skills" value={loading ? "..." : skills.length} />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard label="Pending Approvals" value={loading ? "..." : approvals.length} />
        </Grid>
        <Grid xs={6} sm={3}>
          <StatCard label="Feed Events" value={loading ? "..." : feed.length} />
        </Grid>
      </Grid>

      <Box sx={{ mb: 3 }}>
        <AiActionsCard project={project} />
      </Box>

      {/* File browser -- primary way to understand the project */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <FolderOpenIcon fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight={600}>Project Files</Typography>
        <Typography variant="caption" color="text.secondary">
          {project.root_path}
        </Typography>
      </Stack>
      <Box sx={{ mb: 3 }}>
        <FileBrowser rootPath={project.root_path} height="calc(100vh - 480px)" />
      </Box>

      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <RssFeedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>Recent Activity</Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => navigate(`/projects/${project.id}/feed`)}>
              View all
            </Button>
          </Stack>
          {feed.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No activity yet</Typography>
          ) : (
            feed.map((e) => (
              <Card key={e.id} variant="outlined" sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Typography variant="body2" fontWeight={600}>{e.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {e.type.replace(/_/g, " ")} -- {new Date(e.created_at).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            ))
          )}
        </Grid>

        <Grid xs={12} md={6}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <GavelIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>Pending Approvals</Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => navigate(`/projects/${project.id}/approvals`)}>
              View all
            </Button>
          </Stack>
          {approvals.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No pending approvals</Typography>
          ) : (
            approvals.slice(0, 5).map((a) => (
              <Card key={a.id} variant="outlined" sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Typography variant="body2" fontWeight={600}>{a.title}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    <Chip label={a.type.replace(/_/g, " ")} size="small" variant="outlined" />
                    <Chip label={a.status} size="small" color="warning" variant="outlined" />
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
