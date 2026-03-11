import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Skeleton,
  Paper,
  Fade,
  Badge,
  IconButton,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { api, type SessionMapNode, type SessionMapEdge } from "../lib/api";
import {
  SessionGraph3D,
  VERDICT_HEX,
  complexityColor,
} from "../components/SessionGraph3D";
import type { HoverInfo } from "../components/SessionGraph3D";
import { ChatModal } from "../components/ChatModal";
import { FilterDialog, EMPTY_FILTERS, activeCount } from "../components/FilterDialog";
import type { FilterState } from "../components/FilterDialog";
import { useMqttTopic } from "../hooks/useMqtt";

const VERDICT_LABELS: Record<string, string> = {
  productive: "Productive",
  mixed: "Mixed",
  struggling: "Struggling",
  unanalyzed: "Unanalyzed",
};

const REPO_COLORS: Record<string, string> = {
  "app-platform": "#1976d2",
  "app-notifier": "#7b1fa2",
  "app-gateway": "#2e7d32",
  "sentinel-gateway-communicator": "#e65100",
  "lora-firmware": "#b71c1c",
  "app-documentation": "#00838f",
  "app-tickets": "#4e342e",
  "conmon-dashboard": "#37474f",
  "context": "#283593",
};

export function SessionMap() {
  const [nodes, setNodes] = useState<SessionMapNode[]>([]);
  const [edges, setEdges] = useState<SessionMapEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [chatNode, setChatNode] = useState<SessionMapNode | null>(null);
  const [graphSize, setGraphSize] = useState<{ width: number; height: number } | null>(null);
  const obsRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    obsRef.current?.disconnect();
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setGraphSize({ width, height });
    });
    obs.observe(el);
    obsRef.current = obs;
  }, []);

  const handleNodeClick = useCallback(
    (node: SessionMapNode) => setChatNode(node),
    [],
  );

  const mqttSessions = useMqttTopic("ctx/sessions");
  const mqttStats = useMqttTopic("ctx/stats");

  const fetchMap = useCallback(() => {
    api
      .sessionMap()
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  useEffect(() => {
    if (mqttSessions || mqttStats) fetchMap();
  }, [mqttSessions, mqttStats, fetchMap]);

  const verdicts = [...new Set(nodes.map((n) => n.verdict))].sort();
  const maxCalls = Math.max(1, ...nodes.map((n) => n.totalCalls));
  const minCalls = nodes.length > 0 ? Math.min(...nodes.map((n) => n.totalCalls)) : 0;
  const allRepos = [...new Set(nodes.flatMap((n) => n.repos))].sort();
  const allSkills = useMemo(() => [...new Set(nodes.flatMap((n) => n.skills))].sort(), [nodes]);
  const complexityBounds = useMemo(() => ({ min: minCalls, max: maxCalls }), [minCalls, maxCalls]);

  const { filteredNodes, filteredEdges } = useMemo(() => {
    let kept = nodes;
    if (filters.repos.length > 0) {
      const repoSet = new Set(filters.repos);
      kept = kept.filter((n) => n.repos.some((r) => repoSet.has(r)));
    }
    if (filters.verdicts.length > 0) {
      const vSet = new Set(filters.verdicts);
      kept = kept.filter((n) => vSet.has(n.verdict));
    }
    if (filters.skills.length > 0) {
      const skillSet = new Set(filters.skills);
      kept = kept.filter((n) => n.skills.some((s) => skillSet.has(s)));
    }
    const cr = filters.complexityRange;
    if (cr && (cr[0] > minCalls || cr[1] < maxCalls)) {
      kept = kept.filter((n) => n.totalCalls >= cr[0] && n.totalCalls <= cr[1]);
    }
    if (kept === nodes) return { filteredNodes: nodes, filteredEdges: edges };
    const keptIds = new Set(kept.map((n) => n.id));
    const keptEdges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));
    return { filteredNodes: kept, filteredEdges: keptEdges };
  }, [nodes, edges, filters, minCalls, maxCalls]);

  const chatNeighbors = useMemo<SessionMapNode[]>(() => {
    if (!chatNode) return [];
    const nodeById = new Map(filteredNodes.map((n) => [n.id, n]));
    const neighborIds = new Set<string>();
    for (const e of filteredEdges) {
      if (e.source === chatNode.id) neighborIds.add(e.target);
      if (e.target === chatNode.id) neighborIds.add(e.source);
    }
    return [...neighborIds]
      .map((id) => nodeById.get(id))
      .filter((n): n is SessionMapNode => n !== undefined);
  }, [chatNode, filteredNodes, filteredEdges]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="h5" fontWeight={700}>
          Session Map
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={`${filteredNodes.length} sessions`} variant="outlined" />
          <Chip size="small" label={`${filteredEdges.length} connections`} variant="outlined" />
          <Badge badgeContent={activeCount(filters, complexityBounds)} color="primary">
            <IconButton size="small" onClick={() => setFilterOpen(true)}>
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Badge>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          {verdicts.map((v) => (
            <Chip
              key={v}
              size="small"
              label={VERDICT_LABELS[v] ?? v}
              sx={{ backgroundColor: VERDICT_HEX[v] ?? "#888", color: "#fff", fontWeight: 600, fontSize: "0.7rem" }}
            />
          ))}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="caption" color="text.secondary">complexity</Typography>
          <Box sx={{ display: "flex", borderRadius: 0.5, overflow: "hidden", height: 12, width: 80 }}>
            {Array.from({ length: 20 }, (_, i) => (
              <Box key={i} sx={{ flex: 1, backgroundColor: complexityColor(i, 19) }} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">low &rarr; high</Typography>
        </Stack>
      </Stack>

      <Box sx={{ position: "relative", mb: 1, minHeight: 36 }}>
        <Fade in={hover !== null}>
          <Paper
            variant="outlined"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              px: 1.5,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              maxWidth: 700,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {hover && (
              <>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flexShrink: 0 }}>
                  <Box
                    title={`verdict: ${hover.node.verdict}`}
                    sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: VERDICT_HEX[hover.node.verdict] ?? "#888" }}
                  />
                  <Box
                    title={`complexity: ${hover.node.totalCalls} tool calls`}
                    sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: complexityColor(hover.node.totalCalls, maxCalls) }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ mr: 1 }}>{hover.node.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{hover.node.date}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{hover.node.totalCalls} tool calls</Typography>
                  {hover.node.repos.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>{hover.node.repos.join(", ")}</Typography>
                  )}
                  {hover.neighborSkills.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      linked by: {hover.neighborSkills.slice(0, 5).join(", ")}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Fade>
      </Box>

      {loading ? (
        <Skeleton variant="rounded" sx={{ flex: 1 }} />
      ) : nodes.length === 0 ? (
        <Paper variant="outlined" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">
            No sessions with skill data found. Run the profiler to populate.
          </Typography>
        </Paper>
      ) : (
        <Paper ref={containerRef} variant="outlined" sx={{ flex: 1, overflow: "hidden", borderRadius: 1 }}>
          {graphSize && (
            <SessionGraph3D
              nodes={filteredNodes}
              edges={filteredEdges}
              onHover={setHover}
              onNodeClick={handleNodeClick}
              width={graphSize.width}
              height={graphSize.height}
            />
          )}
        </Paper>
      )}

      <FilterDialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        options={{ repos: allRepos, verdicts, skills: allSkills, complexityBounds }}
        repoColors={REPO_COLORS}
        verdictColors={VERDICT_HEX}
      />

      <ChatModal
        node={chatNode}
        neighbors={chatNeighbors}
        onClose={() => setChatNode(null)}
        onNavigate={setChatNode}
      />
    </Box>
  );
}
