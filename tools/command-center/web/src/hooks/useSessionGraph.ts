import { useMemo } from "react";
import type { SessionMapNode, SessionMapEdge } from "../lib/api";
import { repoClusterCenters, circlePackLayout } from "./repoLayout";

export const VERDICT_HEX: Record<string, string> = {
  productive: "#4caf50",
  mixed: "#ff9800",
  struggling: "#f44336",
  unanalyzed: "#9e9e9e",
};

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const val = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * val).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function complexityColor(totalCalls: number, max: number): string {
  const ratio = max <= 0 ? 0 : Math.min(1, totalCalls / max);
  const hue = Math.round(220 - ratio * 220);
  const lightness = 40 + ratio * 15;
  return hslToHex(hue, 75, lightness);
}

export interface GraphNode {
  id: string;
  label: string;
  color: string;
  val: number;
  x: number;
  y: number;
  z: number;
  repo: string;
  clusterX: number;
  clusterY: number;
  session: SessionMapNode;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  sharedSkills: string[];
  color: string;
}

export interface ForceGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeMap: Map<string, SessionMapNode>;
  maxCalls: number;
}

function linkColor(weight: number, maxWeight: number): string {
  const ratio = weight / Math.max(1, maxWeight);
  const alpha = 0.15 + ratio * 0.45;
  return `rgba(150,180,220,${alpha.toFixed(2)})`;
}

export function useForceGraphData(
  nodes: SessionMapNode[],
  edges: SessionMapEdge[],
): ForceGraphData | null {
  return useMemo(() => {
    if (nodes.length === 0) return null;

    const maxCalls = Math.max(1, ...nodes.map((n) => n.totalCalls));
    const maxWeight = Math.max(1, ...edges.map((e) => e.weight));
    const repoCenters = repoClusterCenters(nodes, edges);
    const positions = circlePackLayout(nodes, repoCenters);
    const nodeMap = new Map<string, SessionMapNode>();

    const graphNodes: GraphNode[] = nodes.map((n) => {
      nodeMap.set(n.id, n);
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const repo = n.repos[0] ?? "";
      const center = repoCenters.get(repo) ?? { x: 0, y: 0 };
      return {
        id: n.id,
        label: n.title,
        color: complexityColor(n.totalCalls, maxCalls),
        val: 1 + Math.log2(1 + n.totalCalls),
        x: pos.x,
        y: pos.y,
        z: (Math.random() - 0.5) * 80,
        repo,
        clusterX: center.x,
        clusterY: center.y,
        session: n,
      };
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const graphLinks: GraphLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        sharedSkills: e.sharedSkills,
        color: linkColor(e.weight, maxWeight),
      }));

    return { nodes: graphNodes, links: graphLinks, nodeMap, maxCalls };
  }, [nodes, edges]);
}
