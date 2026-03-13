import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Skeleton,
  Alert,
  Button,
  Collapse,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useProject } from "../hooks/useProject";
import { api, type ApprovalRecord } from "../lib/api";

function ApprovalCard({
  approval,
  onResolve,
}: {
  approval: ApprovalRecord;
  onResolve: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const { project } = useProject();
  let diff: Record<string, unknown> = {};
  try { diff = JSON.parse(approval.diff); } catch { /* empty */ }

  async function handleAction(action: "approve" | "reject") {
    if (!project) return;
    setActing(true);
    try {
      if (action === "approve") {
        await api.approveApproval(project.id, approval.id);
      } else {
        await api.rejectApproval(project.id, approval.id);
      }
      onResolve();
    } finally {
      setActing(false);
    }
  }

  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>{approval.title}</Typography>
            <Typography variant="body2" color="text.secondary">{approval.summary}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              <Chip label={approval.type.replace(/_/g, " ")} size="small" variant="outlined" />
              <Chip
                label={approval.status}
                size="small"
                color={approval.status === "pending" ? "warning" : approval.status === "approved" ? "success" : "error"}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                {new Date(approval.created_at).toLocaleString()}
              </Typography>
            </Stack>
          </Box>
          <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: "0.75rem" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(diff, null, 2)}
            </pre>
          </Box>
        </Collapse>

        {approval.status === "pending" && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              disabled={acting}
              onClick={() => handleAction("approve")}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<CloseIcon />}
              disabled={acting}
              onClick={() => handleAction("reject")}
            >
              Reject
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function Approvals() {
  const { project } = useProject();
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState<ApprovalRecord[]>([]);
  const [resolved, setResolved] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!project) return;
    setLoading(true);
    Promise.all([
      api.listApprovals(project.id, "pending"),
      api.listApprovals(project.id, "approved"),
    ])
      .then(([p, r]) => {
        setPending(p);
        setResolved(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project]);

  useEffect(() => { load(); }, [load]);

  if (!project) return null;

  const items = tab === 0 ? pending : resolved;

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <GavelIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Approval Queue</Typography>
        {pending.length > 0 && (
          <Chip label={`${pending.length} pending`} size="small" color="warning" />
        )}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Pending (${pending.length})`} />
        <Tab label="History" />
      </Tabs>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1.5 }} />
        ))
      ) : items.length === 0 ? (
        <Alert severity="info">
          {tab === 0
            ? "No pending approvals. The system will propose changes as it analyzes sessions."
            : "No resolved approvals yet."}
        </Alert>
      ) : (
        items.map((a) => (
          <ApprovalCard key={a.id} approval={a} onResolve={load} />
        ))
      )}
    </Box>
  );
}
