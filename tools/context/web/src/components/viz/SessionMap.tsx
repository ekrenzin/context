import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import ForceGraph3D from "react-force-graph-3d";
import type { SessionMapNode } from "../../lib/api";
import { api } from "../../lib/api";
import { useForceGraphData, VERDICT_HEX } from "../../hooks/useSessionGraph";
import type { GraphNode } from "../../hooks/useSessionGraph";
import { useRefetchOnMqtt } from "../../hooks/useRefetchOnMqtt";
import SessionTooltip from "./SessionTooltip";
import * as THREE from "three";

function nodeColor(verdict: string): string {
  return VERDICT_HEX[verdict] ?? VERDICT_HEX.unanalyzed;
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export default function SessionMap() {
  const [nodes, setNodes] = useState<SessionMapNode[]>([]);
  const [edges, setEdges] = useState<Array<{
    source: string;
    target: string;
    weight: number;
    sharedSkills: string[];
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SessionMapNode | null>(null);
  const { generation } = useRefetchOnMqtt("ctx/sessions/+");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useContainerSize(containerRef);

  useEffect(() => {
    setLoading(true);
    api
      .sessionMap()
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [generation]);

  const graphData = useForceGraphData(nodes, edges);

  const forceData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return { nodes: graphData.nodes, links: graphData.links };
  }, [graphData]);

  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const radius = node.val * 1.5;
      const geo = new THREE.SphereGeometry(radius, 16, 12);
      const mat = new THREE.MeshLambertMaterial({
        color: nodeColor(node.session.verdict),
        transparent: true,
        opacity: 0.85,
      });
      return new THREE.Mesh(geo, mat);
    },
    [],
  );

  const handleNodeHover = useCallback(
    (node: object | null) => {
      const gn = node as GraphNode | null;
      setHoveredNode(gn?.session ?? null);
    },
    [],
  );

  if (loading && nodes.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!graphData || graphData.nodes.length === 0) {
    return <Alert severity="info">No session data for the map.</Alert>;
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <ForceGraph3D
        graphData={forceData}
        width={width}
        height={height}
        nodeThreeObject={nodeThreeObject as (node: object) => THREE.Object3D}
        onNodeHover={handleNodeHover}
        linkColor={(link: { color?: string }) => link.color ?? "rgba(150,180,220,0.3)"}
        linkWidth={(link: { weight?: number }) => Math.max(0.3, (link.weight ?? 1) * 0.1)}
        linkOpacity={0.6}
        backgroundColor="rgba(0,0,0,0)"
        warmupTicks={50}
        cooldownTime={3000}
      />
      {hoveredNode && (
        <Box
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <SessionTooltip node={hoveredNode} />
        </Box>
      )}
    </Box>
  );
}
