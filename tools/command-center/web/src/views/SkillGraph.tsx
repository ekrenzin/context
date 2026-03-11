import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Skeleton,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { api, type SkillNode, type SkillEdge } from "../lib/api";
import { CytoscapeGraph, CATEGORY_COLORS } from "../components/CytoscapeGraph";
import { SkillFlowGraph } from "../components/SkillFlowGraph";
import { SkillDetailDrawer } from "../components/SkillDetailDrawer";

const CATEGORY_LABELS: Record<string, string> = {
  lifecycle: "Lifecycle",
  quality:   "Quality",
  memory:    "Memory",
  devtools:  "Dev Tools",
  platform:  "Platform",
  comms:     "Comms",
  unknown:   "Other",
};

type ViewMode = "network" | "flow";

export function SkillGraph() {
  const [nodes, setNodes] = useState<SkillNode[]>([]);
  const [edges, setEdges] = useState<SkillEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillNode | null>(null);
  const [view, setView] = useState<ViewMode>("network");

  useEffect(() => {
    api.skillGraph()
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(nodes.map((n) => n.category))].sort();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="h5" fontWeight={700}>Skill Graph</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v: ViewMode | null) => { if (v) setView(v); }}
            size="small"
          >
            <ToggleButton value="network">Network</ToggleButton>
            <ToggleButton value="flow">Flow</ToggleButton>
          </ToggleButtonGroup>
          <Chip size="small" label={`${nodes.length} skills`} variant="outlined" />
          <Chip size="small" label={`${edges.length} connections`} variant="outlined" />
        </Stack>
      </Box>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
        {categories.map((cat) => {
          const color = CATEGORY_COLORS[cat] ?? "#888";
          return (
            <Chip
              key={cat}
              size="small"
              label={CATEGORY_LABELS[cat] ?? cat}
              sx={{
                backgroundColor: `${color}22`,
                color,
                border: `1px solid ${color}55`,
                fontWeight: 600,
                fontSize: "0.7rem",
                letterSpacing: "0.02em",
                boxShadow: `0 0 6px ${color}22`,
              }}
            />
          );
        })}
      </Stack>

      {loading ? (
        <Skeleton variant="rounded" sx={{ flex: 1 }} />
      ) : (
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            borderColor: "divider",
            boxShadow: (t) =>
              `inset 0 0 40px ${t.palette.mode === "dark" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          {!selected && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                pointerEvents: "none",
                zIndex: 1,
                whiteSpace: "nowrap",
              }}
            >
              Click a node to see details
            </Typography>
          )}
          {view === "network" ? (
            <CytoscapeGraph
              nodes={nodes}
              edges={edges}
              onSelect={setSelected}
            />
          ) : (
            <SkillFlowGraph
              nodes={nodes}
              edges={edges}
              onHover={() => {}}
              onSelect={setSelected}
            />
          )}
        </Paper>
      )}

      <SkillDetailDrawer node={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
