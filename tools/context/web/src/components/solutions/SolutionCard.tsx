import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Box,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplayIcon from "@mui/icons-material/Replay";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface Solution {
  id: string;
  name: string;
  problem: string;
  description: string;
  status: string;
  components: Array<{ type: string }>;
  usage_count: number;
}

const STATUS_MAP: Record<string, { label: string; color: "success" | "default" | "warning" | "error" }> = {
  active: { label: "Active", color: "success" },
  stopped: { label: "Paused", color: "default" },
  building: { label: "Building", color: "warning" },
  error: { label: "Needs Attention", color: "error" },
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${res.status}`);
  return res.json();
}

export function SolutionCard({ sol, onAction }: { sol: Solution; onAction: () => void }) {
  const navigate = useNavigate();
  const status = STATUS_MAP[sol.status] ?? STATUS_MAP.error;
  const [rebuilding, setRebuilding] = useState(false);
  const running = sol.status === "active" || sol.status === "building";

  const rebuild = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRebuilding(true);
    try {
      await fetchJson(`/api/solutions/${sol.id}/rebuild`, { method: "POST" });
      onAction();
    } finally {
      setRebuilding(false);
    }
  };

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchJson(`/api/solutions/${sol.id}/${running ? "stop" : "start"}`, { method: "POST" });
    onAction();
  };

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchJson(`/api/solutions/${sol.id}`, { method: "DELETE" });
    onAction();
  };

  return (
    <Card
      variant="outlined"
      sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
      onClick={() => navigate(`/solutions/${sol.id}`)}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>{sol.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{sol.description || sol.problem}</Typography>
          </Box>
          <Chip label={status.label} color={status.color} size="small" sx={{ ml: 1, flexShrink: 0 }} />
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Used {sol.usage_count ?? 0} times</Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="View details">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/solutions/${sol.id}`); }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {sol.components.some((c) => c.type === "service") && (
              <Tooltip title={running ? "Stop" : "Start"}>
                <IconButton size="small" onClick={toggle}>
                  {running ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Regenerate">
              <span>
                <IconButton size="small" onClick={rebuild} disabled={rebuilding}>
                  {rebuilding ? <CircularProgress size={16} /> : <ReplayIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={remove}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
