import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Skeleton,
  Alert,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { api } from "../lib/api";
import { CardGrid } from "../components/CardGrid";
import { NewProposalDialog } from "../components/NewProposalDialog";

interface ProposalSummary {
  slug: string;
  title: string;
  date: string;
  status: string;
  repo: string;
  ticket: string | null;
  taskCount: number;
  tasksByStatus: Record<string, number>;
}

const STATUS_ACCENT: Record<string, string> = {
  draft: "grey.500",
  "in-progress": "warning.main",
  completed: "success.main",
  rejected: "error.main",
};

function taskProgress(tasksByStatus: Record<string, number>, total: number) {
  if (total === 0) return 0;
  return Math.round(((tasksByStatus.completed ?? 0) / total) * 100);
}

function ProposalCard({ proposal, onBuild, onDelete }: { proposal: ProposalSummary; onBuild: (slug: string) => void; onDelete: (slug: string) => void }) {
  const navigate = useNavigate();
  const progress = taskProgress(proposal.tasksByStatus, proposal.taskCount);
  const accent = STATUS_ACCENT[proposal.status] ?? "grey.500";

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: "pointer",
        "&:hover": { borderColor: "primary.main" },
        height: "100%",
        borderLeft: 4,
        borderLeftColor: accent,
      }}
      onClick={() => navigate(`/proposals/${proposal.slug}`)}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          {proposal.title}
        </Typography>

        {proposal.repo && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {proposal.repo}
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {proposal.tasksByStatus.completed ?? 0} / {proposal.taskCount} tasks
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progress}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
            {Object.entries(proposal.tasksByStatus).map(([status, count]) => (
              <Chip
                key={status}
                label={`${count} ${status}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.7rem", height: 22 }}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            {proposal.status !== "completed" && (
              <Tooltip title="Build this proposal with Claude">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RocketLaunchIcon sx={{ fontSize: 14 }} />}
                  onClick={(e) => { e.stopPropagation(); onBuild(proposal.slug); }}
                  sx={{ fontSize: "0.7rem", height: 26, textTransform: "none" }}
                >
                  Build
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Delete proposal">
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={(e) => { e.stopPropagation(); onDelete(proposal.slug); }}
                sx={{ fontSize: "0.7rem", height: 26, minWidth: 32, px: 0.5 }}
              >
                <DeleteIcon sx={{ fontSize: 14 }} />
              </Button>
            </Tooltip>
          </Stack>
        </Stack>

        {proposal.date && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {proposal.date}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Box sx={{ textAlign: "center", py: 8, maxWidth: 480, mx: "auto" }}>
      <DescriptionIcon sx={{ fontSize: 56, color: "text.secondary", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        No proposals yet
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Proposals are created by AI agents before implementation begins.
        Ask an agent to "write a proposal" for your next feature.
      </Typography>
    </Box>
  );
}

export default function Proposals() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/proposals")
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/proposals: ${r.status}`);
        return r.json();
      })
      .then(setProposals)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuild = useCallback(async (slug: string) => {
    try {
      const result = await api.buildProposal(slug);
      navigate(`/terminal?session=${result.sessionId}&label=Building: ${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (!deleteSlug) return;
    try {
      await api.deleteProposal(deleteSlug);
      setDeleteSlug(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleteSlug(null);
    }
  }, [deleteSlug, load]);

  const handleCreated = useCallback((sessionId: string) => {
    navigate(`/terminal?session=${sessionId}&label=New Proposal`);
  }, [navigate]);

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <CardGrid>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i}>
              <Skeleton variant="rounded" height={160} />
            </Box>
          ))}
        </CardGrid>
      </Box>
    );
  }

  if (error) return <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>;

  if (proposals.length === 0) {
    return (
      <>
        <EmptyState />
        <Box sx={{ textAlign: "center" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disableElevation
          >
            New Proposal
          </Button>
        </Box>
        <NewProposalDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      </>
    );
  }

  const byStatus = proposals.reduce<Record<string, ProposalSummary[]>>((acc, p) => {
    (acc[p.status] ??= []).push(p);
    return acc;
  }, {});

  const statusOrder = ["in-progress", "draft", "completed", "rejected"];
  const sections = statusOrder.filter((s) => byStatus[s]?.length);

  return (
    <Box sx={{ pt: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {proposals.length} proposal{proposals.length !== 1 ? "s" : ""} --{" "}
          {proposals.filter((p) => p.status === "in-progress").length} in progress,{" "}
          {proposals.filter((p) => p.status === "draft").length} draft
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disableElevation
          sx={{ textTransform: "none" }}
        >
          New Proposal
        </Button>
      </Stack>

      {sections.map((status) => (
        <Box key={status} sx={{ mb: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: "capitalize" }}>
            {status.replace("-", " ")} ({byStatus[status].length})
          </Typography>
          <CardGrid>
            {byStatus[status].map((p) => (
              <Box key={p.slug}>
                <ProposalCard proposal={p} onBuild={handleBuild} onDelete={setDeleteSlug} />
              </Box>
            ))}
          </CardGrid>
        </Box>
      ))}

      <NewProposalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      <Dialog open={!!deleteSlug} onClose={() => setDeleteSlug(null)}>
        <DialogTitle>Delete proposal?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete <strong>{deleteSlug}</strong> and all its task files from disk.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSlug(null)}>Cancel</Button>
          <Button color="error" variant="contained" disableElevation onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
