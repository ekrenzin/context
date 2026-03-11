import { useMemo, useCallback } from "react";
import { useTheme, alpha } from "@mui/material/styles";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import type { SkillNode, SkillEdge } from "../lib/api";
import type { SkillNode as SkillNodeHover } from "../lib/api";
import { CATEGORY_COLORS } from "./CytoscapeGraph";

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;

function applyDagreLayout(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of rfNodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of rfEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const nodes = rfNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes, edges: rfEdges };
}

function toRFNodes(skillNodes: SkillNode[]): Node[] {
  return skillNodes.map((n) => {
    const color = CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS.unknown;
    return {
      id: n.id,
      type: "default",
      position: { x: 0, y: 0 },
      data: { label: n.id },
      style: {
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 8px",
        boxShadow: `0 0 10px ${color}33, inset 0 0 8px ${color}11`,
      },
    };
  });
}

function toRFEdges(skillEdges: SkillEdge[], edgeColor: string, arrowColor: string): Edge[] {
  return skillEdges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: arrowColor },
    style: { stroke: edgeColor, strokeWidth: 1.2 },
    type: "smoothstep",
  }));
}

interface Props {
  nodes: SkillNode[];
  edges: SkillEdge[];
  onHover: (node: SkillNodeHover | null) => void;
  onSelect?: (node: SkillNodeHover | null) => void;
}

export function SkillFlowGraph({ nodes, edges, onHover, onSelect }: Props) {
  const { palette } = useTheme();

  const nodeMap = useMemo(() => {
    const m = new Map<string, SkillNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const edgeColor = alpha(palette.text.primary, 0.28);
  const arrowColor = alpha(palette.text.primary, 0.45);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const rfNodes = toRFNodes(nodes);
    const rfEdges = toRFEdges(edges.filter((e) => e.type === "trigger"), edgeColor, arrowColor);
    return applyDagreLayout(rfNodes, rfEdges);
  }, [nodes, edges, edgeColor, arrowColor]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const skill = nodeMap.get(node.id);
      if (skill) onHover(skill);
    },
    [nodeMap, onHover],
  );

  const onNodeMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const skill = nodeMap.get(node.id);
      onSelect?.(skill ?? null);
    },
    [nodeMap, onSelect],
  );

  const gridColor = alpha(palette.text.primary, 0.05);

  return (
    <ReactFlow
      nodes={layoutNodes}
      edges={layoutEdges}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      colorMode={palette.mode}
      style={{ background: palette.background.default }}
    >
      <Background color={gridColor} gap={24} size={1} />
      <Controls
        showInteractive={false}
        style={{
          background: alpha(palette.background.paper, 0.8),
          border: `1px solid ${palette.divider}`,
        }}
      />
      <MiniMap
        nodeColor={(n) => {
          const bg = n.style?.background as string | undefined;
          return bg ?? palette.text.disabled;
        }}
        maskColor={alpha(palette.background.default, 0.6)}
        style={{
          background: alpha(palette.background.paper, 0.85),
          border: `1px solid ${palette.divider}`,
          borderRadius: 6,
        }}
      />
    </ReactFlow>
  );
}
