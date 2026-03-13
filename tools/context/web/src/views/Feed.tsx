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
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  IconButton,
} from "@mui/material";
import RssFeedIcon from "@mui/icons-material/RssFeed";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useProject } from "../hooks/useProject";
import { useMqttBuffer } from "../hooks/useMqtt";
import { api, type FeedEvent } from "../lib/api";

const EVENT_TYPES = [
  "session_analyzed",
  "skill_proposed",
  "memory_written",
  "pattern_detected",
  "approval_resolved",
  "workspace_synced",
];

const TYPE_COLORS: Record<string, "primary" | "secondary" | "success" | "warning" | "info"> = {
  session_analyzed: "primary",
  skill_proposed: "secondary",
  memory_written: "success",
  approval_resolved: "warning",
  workspace_synced: "info",
};

function EventCard({ event }: { event: FeedEvent }) {
  const [expanded, setExpanded] = useState(false);
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse(event.detail); } catch { /* empty */ }

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600}>{event.title}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              <Chip
                label={event.type.replace(/_/g, " ")}
                size="small"
                color={TYPE_COLORS[event.type] ?? "default"}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                {new Date(event.created_at).toLocaleString()}
              </Typography>
            </Stack>
          </Box>
          {Object.keys(detail).length > 0 && (
            <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </Stack>
        <Collapse in={expanded}>
          <Box sx={{ mt: 1, p: 1, bgcolor: "action.hover", borderRadius: 1, fontSize: "0.75rem" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(detail, null, 2)}
            </pre>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function Feed() {
  const { project } = useProject();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const liveEvents = useMqttBuffer<FeedEvent>(
    project ? `ctx/projects/${project.id}/feed` : "",
  );

  const load = useCallback(() => {
    if (!project) return;
    setLoading(true);
    api.listFeed(project.id, { type: filter ?? undefined, limit: 50 })
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project, filter]);

  useEffect(() => { load(); }, [load]);

  const allEvents = [...liveEvents.filter((e) => !events.some((ex) => ex.id === e.id)), ...events];

  if (!project) return null;

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <RssFeedIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Activity Feed</Typography>
      </Stack>

      <ToggleButtonGroup
        value={filter}
        exclusive
        onChange={(_, v) => setFilter(v)}
        size="small"
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        <ToggleButton value={null}>All</ToggleButton>
        {EVENT_TYPES.map((t) => (
          <ToggleButton key={t} value={t}>{t.replace(/_/g, " ")}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />
        ))
      ) : allEvents.length === 0 ? (
        <Alert severity="info">
          No events yet. Activity will appear here as the system processes sessions and evolves intelligence.
        </Alert>
      ) : (
        allEvents.map((e) => <EventCard key={e.id} event={e} />)
      )}
    </Box>
  );
}
