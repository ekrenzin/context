import cytoscape from "cytoscape";

export const CATEGORY_COLORS: Record<string, string> = {
  lifecycle: "#5B8FF9",
  quality:   "#5AD8A6",
  memory:    "#F6BD16",
  devtools:  "#E86452",
  platform:  "#6DC8EC",
  comms:     "#945FB9",
  unknown:   "#888888",
};

export interface GraphColors {
  textBg: string;
  edge: string;
  edgeActive: string;
  edgeHighlight: string;
  border: string;
}

export function buildStyles(
  maxDeg: number,
  colors: GraphColors,
): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "font-size": 10,
        "font-family": "'Inter', -apple-system, sans-serif",
        "text-valign": "bottom",
        "text-margin-y": 5,
        color: (ele: cytoscape.NodeSingular) =>
          CATEGORY_COLORS[ele.data("category")] ?? CATEGORY_COLORS.unknown,
        "text-background-color": colors.textBg,
        "text-background-opacity": 0.7,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
        "background-color": (ele: cytoscape.NodeSingular) =>
          CATEGORY_COLORS[ele.data("category")] ?? CATEGORY_COLORS.unknown,
        width: (ele: cytoscape.NodeSingular) => {
          const d = ele.data("deg") as number;
          return 18 + (d / maxDeg) * 32;
        },
        height: (ele: cytoscape.NodeSingular) => {
          const d = ele.data("deg") as number;
          return 18 + (d / maxDeg) * 32;
        },
        "border-width": 0,
        "overlay-opacity": 0,
      } as cytoscape.Css.Node,
    },
    {
      selector: "edge",
      style: {
        width: 0.6,
        "line-color": colors.edge,
        "curve-style": "bezier",
        "overlay-opacity": 0,
        "transition-property": "line-color, width",
        "transition-duration": 120,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge[edgeType='trigger']",
      style: {
        width: 1,
        "line-color": colors.edgeActive,
        "target-arrow-color": colors.edgeActive,
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.7,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.highlighted",
      style: {
        width: 2,
        "line-color": colors.edgeHighlight,
        "target-arrow-color": colors.edgeHighlight,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "node.dimmed",
      style: { opacity: 0.15 } as cytoscape.Css.Node,
    },
    {
      selector: "node.selected-node",
      style: {
        "border-width": 2.5,
        "border-color": colors.border,
        "border-opacity": 0.9,
        opacity: 1,
      } as cytoscape.Css.Node,
    },
    {
      selector: "node:active",
      style: { "overlay-opacity": 0 } as cytoscape.Css.Node,
    },
  ];
}
