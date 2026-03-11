import { useRef, useEffect, useCallback, useMemo } from "react";
import { useTheme, alpha } from "@mui/material/styles";
import cytoscape from "cytoscape";
import type { SkillNode, SkillEdge } from "../lib/api";
import { buildStyles, type GraphColors } from "./cytoscapeStyles";

export { CATEGORY_COLORS } from "./cytoscapeStyles";

interface Props {
  nodes: SkillNode[];
  edges: SkillEdge[];
  onHover?: (node: SkillNode | null) => void;
  onSelect?: (node: SkillNode | null) => void;
}

function buildDegreeMap(edges: SkillEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  return deg;
}

export function useGraphColors(): GraphColors {
  const { palette } = useTheme();
  return useMemo(() => ({
    textBg: palette.background.paper,
    edge: palette.divider,
    edgeActive: alpha(palette.text.primary, 0.15),
    edgeHighlight: alpha(palette.text.primary, 0.6),
    border: palette.text.primary,
  }), [palette]);
}

export function CytoscapeGraph({ nodes, edges, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { palette } = useTheme();
  const colors = useGraphColors();
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  onHoverRef.current = onHover;
  onSelectRef.current = onSelect;

  const nodeMap = useCallback(() => {
    const map = new Map<string, SkillNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || nodes.length === 0) return;

    const degrees = buildDegreeMap(edges);
    const maxDeg = Math.max(1, ...degrees.values());

    const cy = cytoscape({
      container: el,
      elements: [
        ...nodes.map((n) => ({
          data: { id: n.id, label: n.id, category: n.category, deg: degrees.get(n.id) ?? 0 },
        })),
        ...edges.map((e, i) => ({
          data: { id: `e${i}`, source: e.source, target: e.target, edgeType: e.type },
        })),
      ],
      style: buildStyles(maxDeg, colors),
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 800,
        nodeRepulsion: () => 6000,
        idealEdgeLength: () => 120,
        gravity: 0.25,
        numIter: 500,
        nodeDimensionsIncludeLabels: true,
      } as cytoscape.CoseLayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    const nMap = nodeMap();
    const borderColor = colors.border;

    cy.on("mouseover", "node", (evt) => {
      const node = evt.target;
      const n = nMap.get(node.id());
      if (n) onHoverRef.current?.(n);

      const neighborhood = node.neighborhood().add(node);
      cy.elements().not(neighborhood).addClass("dimmed");
      node.connectedEdges().addClass("highlighted");
      node.animate(
        { style: { "border-width": 2, "border-color": borderColor, "border-opacity": 0.8 } },
        { duration: 120 },
      );
    });

    cy.on("mouseout", "node", (evt) => {
      onHoverRef.current?.(null);
      cy.elements().removeClass("dimmed").removeClass("highlighted");
      const keepBorder = evt.target.hasClass("selected-node");
      evt.target.animate(
        { style: { "border-width": keepBorder ? 2.5 : 0, "border-color": borderColor } },
        { duration: 120 },
      );
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const n = nMap.get(node.id());
      cy.elements().removeClass("selected-node");
      node.addClass("selected-node");
      onSelectRef.current?.(n ?? null);
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass("selected-node");
        onSelectRef.current?.(null);
      }
    });

    cyRef.current = cy;

    const obs = new ResizeObserver(() => cy.resize());
    obs.observe(el);

    return () => {
      obs.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, nodeMap, colors]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 300, background: palette.background.default }}
    />
  );
}
