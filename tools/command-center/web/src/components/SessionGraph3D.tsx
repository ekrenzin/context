import { useRef, useCallback, useEffect, useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { SessionMapNode, SessionMapEdge } from "../lib/api";
import {
  useForceGraphData,
  complexityColor,
  VERDICT_HEX,
} from "../hooks/useSessionGraph";
import type { GraphNode, GraphLink } from "../hooks/useSessionGraph";

export { VERDICT_HEX, complexityColor };

export interface HoverInfo {
  node: SessionMapNode;
  neighborSkills: string[];
}

interface Props {
  nodes: SessionMapNode[];
  edges: SessionMapEdge[];
  onHover: (info: HoverInfo | null) => void;
  onNodeClick: (node: SessionMapNode) => void;
  width?: number;
  height?: number;
}

function buildNeighborSkills(
  links: GraphLink[],
  nodeId: string,
): string[] {
  const counts = new Map<string, number>();
  for (const l of links) {
    const src = typeof l.source === "string" ? l.source : (l.source as GraphNode)?.id;
    const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode)?.id;
    if (src !== nodeId && tgt !== nodeId) continue;
    for (const s of l.sharedSkills) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
}

export function SessionGraph3D({
  nodes,
  edges,
  onHover,
  onNodeClick,
  width,
  height,
}: Props) {
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>();
  const { palette } = useTheme();
  const data = useForceGraphData(nodes, edges);

  const graphData = useMemo(() => {
    if (!data) return null;
    return { nodes: [...data.nodes], links: [...data.links] };
  }, [data]);

  const configuredRef = useRef(false);
  useEffect(() => {
    if (configuredRef.current) return;
    const fg = fgRef.current;
    if (!fg || !graphData || graphData.nodes.length === 0) return;
    const charge = fg.d3Force("charge") as unknown as
      | { strength: (v: number) => void }
      | undefined;
    charge?.strength(-80);
    const link = fg.d3Force("link") as unknown as
      | { distance: (v: number) => void }
      | undefined;
    link?.distance(40);

    const CLUSTER_STRENGTH = 0.15;
    function clusterForce(alpha: number) {
      for (const n of graphData!.nodes) {
        const node = n as GraphNode & { vx?: number; vy?: number };
        node.vx = (node.vx ?? 0) + (node.clusterX - node.x) * CLUSTER_STRENGTH * alpha;
        node.vy = (node.vy ?? 0) + (node.clusterY - node.y) * CLUSTER_STRENGTH * alpha;
      }
    }
    (fg as unknown as { d3Force: (name: string, fn: unknown) => void }).d3Force("cluster", clusterForce);

    configuredRef.current = true;
  });

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      if (!node || !data) {
        onHover(null);
        return;
      }
      const neighborSkills = buildNeighborSkills(data.links, node.id);
      onHover({ node: node.session, neighborSkills });
    },
    [data, onHover],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick(node.session);
    },
    [onNodeClick],
  );

  const nodeColor = useCallback(
    (node: GraphNode) => node.color,
    [],
  );

  const labelSecondary = palette.text.secondary;
  const labelDisabled = palette.text.disabled;
  const nodeLabel = useCallback(
    (node: GraphNode) => {
      const n = node.session;
      return `<div style="text-align:center;padding:4px 8px">
        <b>${n.title}</b><br/>
        <span style="color:${labelSecondary}">${n.date} &middot; ${n.totalCalls} calls</span>
        ${n.repos.length > 0 ? `<br/><span style="color:${labelDisabled}">${n.repos.join(", ")}</span>` : ""}
      </div>`;
    },
    [labelSecondary, labelDisabled],
  );

  const maxLinkWeight = useMemo(
    () => Math.max(1, ...graphData?.links.map((l) => l.weight) ?? [1]),
    [graphData],
  );
  const linkWidth = useCallback(
    (link: GraphLink) => 0.3 + (link.weight / maxLinkWeight) * 2,
    [maxLinkWeight],
  );

  if (!graphData || graphData.nodes.length === 0) return null;

  return (
    <ForceGraph3D<GraphNode, GraphLink>
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={palette.background.default}
      showNavInfo={false}
      nodeId="id"
      nodeColor={nodeColor}
      nodeVal="val"
      nodeLabel={nodeLabel}
      nodeOpacity={0.9}
      nodeResolution={12}
      linkColor="color"
      linkWidth={linkWidth}
      linkOpacity={0.6}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      enableNodeDrag
      cooldownTime={5000}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
    />
  );
}
