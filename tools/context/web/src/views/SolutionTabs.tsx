import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Paper,
  Alert,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";

interface SolutionComponent {
  type: string;
  [key: string]: unknown;
}

export interface SolutionData {
  id: string;
  name: string;
  problem: string;
  description: string;
  proposal: string;
  project_id: string | null;
  status: string;
  components: SolutionComponent[];
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  health?: { running: boolean; logTail: string[] };
}

const COMPONENT_LABELS: Record<string, string> = {
  service: "Backend Service",
  view: "UI View",
  skill: "AI Skill",
  rule: "Workspace Rule",
  memory: "Memory Entry",
  mqtt: "Event Bus",
};

export function OverviewTab({ solution }: { solution: SolutionData }) {
  return (
    <Stack spacing={2}>
      {solution.description && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Description</Typography>
          <Typography variant="body2" color="text.secondary">{solution.description}</Typography>
        </Paper>
      )}

      {solution.proposal && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Proposal</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
            {solution.proposal}
          </Typography>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Problem</Typography>
        <Typography variant="body2" color="text.secondary">{solution.problem}</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Components</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {solution.components.map((c, i) => (
            <Chip key={i} label={COMPONENT_LABELS[c.type] ?? c.type} size="small" variant="outlined" />
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Metadata</Typography>
        <Typography variant="body2">Created: {new Date(solution.created_at).toLocaleString()}</Typography>
        <Typography variant="body2">Updated: {new Date(solution.updated_at).toLocaleString()}</Typography>
        <Typography variant="body2">
          Used: {solution.usage_count} time{solution.usage_count !== 1 ? "s" : ""}
        </Typography>
      </Paper>
    </Stack>
  );
}

export function ViewTab({ id, running, name }: { id: string; running: boolean; name: string }) {
  if (!running) {
    return <Alert severity="warning">Service is not running. Start the solution to see its view.</Alert>;
  }
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 1 }}>
      <iframe
        src={`/api/solutions/${id}/app`}
        title={`${name} view`}
        style={{ width: "100%", height: "calc(100vh - 260px)", border: "none", display: "block", minHeight: 400 }}
      />
    </Paper>
  );
}

export function CodeTab({ id }: { id: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetch(`/api/solutions/${id}/files`).then((r) => r.json()).then((d) => {
      setFiles(d.files ?? []);
      if (d.files?.length) setSelected(d.files[0]);
    });
  }, [id]);

  useEffect(() => {
    if (!selected) return;
    setLoadingContent(true);
    fetch(`/api/solutions/${id}/files/${selected}`)
      .then((r) => r.text())
      .then(setContent)
      .finally(() => setLoadingContent(false));
  }, [id, selected]);

  return (
    <Stack direction="row" spacing={2} sx={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
      <Paper variant="outlined" sx={{ width: 220, flexShrink: 0, overflow: "auto" }}>
        <List dense disablePadding>
          {files.map((f) => (
            <ListItemButton key={f} selected={f === selected} onClick={() => setSelected(f)}>
              <ListItemText primary={f} primaryTypographyProps={{ variant: "caption", noWrap: true }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Paper
        variant="outlined"
        sx={{
          flex: 1, overflow: "auto", p: 1.5,
          bgcolor: "background.default", color: "text.primary",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}
      >
        {loadingContent ? "Loading..." : content}
      </Paper>
    </Stack>
  );
}

export function LogsTab({ id }: { id: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(() => {
    fetch(`/api/solutions/${id}/logs`)
      .then((r) => r.json())
      .then((d) => {
        setLines(d.logTail ?? []);
        setIsRunning(d.running ?? false);
      });
  }, [id]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Process: {isRunning ? "running" : "not running"} | Auto-refreshes every 3s
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5, height: "calc(100vh - 300px)", minHeight: 300, overflow: "auto",
          bgcolor: "background.default", color: "text.primary",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
        }}
      >
        {lines.length === 0 && <Typography variant="caption" component="span" color="text.secondary">No log output yet.</Typography>}
        {lines.map((line, i) => <div key={i}>{line}</div>)}
        <div ref={bottomRef} />
      </Paper>
    </Box>
  );
}
