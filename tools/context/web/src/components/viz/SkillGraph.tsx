import { useRef, useState, useCallback } from "react";
import { Box, CircularProgress, Alert, useTheme } from "@mui/material";
import CytoscapeComponent from "react-cytoscapejs";
import type cytoscape from "cytoscape";
import { useSkillGraph } from "../../hooks/useSkillGraph";
import {
  buildStyles,
  type GraphColors,
} from "../cytoscapeStyles";
import SkillDetail from "./SkillDetail";

export default function SkillGraph() {
  const theme = useTheme();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { elements, maxDeg, loading, error } = useSkillGraph();
  const [selected, setSelected] = useState<string | null>(null);

  const colors: GraphColors = {
    textBg: theme.palette.background.paper,
    edge: theme.palette.divider,
    edgeActive: theme.palette.primary.main,
    edgeHighlight: theme.palette.secondary.main,
    border: theme.palette.primary.main,
  };

  const stylesheet = buildStyles(maxDeg, colors);

  const highlightNode = useCallback((nodeId: string) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("highlighted dimmed selected-node");
    const node = cy.getElementById(nodeId);
    if (!node.length) return;

    const neighborhood = node.neighborhood().add(node);
    cy.elements().not(neighborhood).addClass("dimmed");
    neighborhood.edges().addClass("highlighted");
    node.addClass("selected-node");
    setSelected(nodeId);
  }, []);

  const clearHighlight = useCallback(() => {
    const cy = cyRef.current;
    if (cy) cy.elements().removeClass("highlighted dimmed selected-node");
    setSelected(null);
  }, []);

  const handleCy = useCallback(
    (cy: cytoscape.Core) => {
      cyRef.current = cy;
      cy.on("tap", "node", (evt) => {
        highlightNode(evt.target.id());
      });
      cy.on("tap", (evt) => {
        if (evt.target === cy) clearHighlight();
      });
    },
    [highlightNode, clearHighlight],
  );

  if (loading && elements.length === 0) {
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
  if (elements.length === 0) {
    return <Alert severity="info">No skills found.</Alert>;
  }

  const selectedNode = selected
    ? elements.find((e) => e.data.id === selected)
    : null;

  return (
    <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <CytoscapeComponent
          elements={elements}
          stylesheet={stylesheet}
          layout={{
            name: "cose",
            animate: false,
            nodeDimensionsIncludeLabels: true,
            idealEdgeLength: () => 120,
            nodeRepulsion: () => 8000,
            padding: 30,
          } as cytoscape.LayoutOptions}
          style={{ width: "100%", height: "100%" }}
          cy={handleCy}
        />
      </Box>
      {selectedNode && (
        <SkillDetail
          id={selectedNode.data.id!}
          description={selectedNode.data.description ?? ""}
          category={selectedNode.data.category ?? ""}
          relatedSkills={selectedNode.data.relatedSkills ?? []}
          onClose={clearHighlight}
          onNavigate={highlightNode}
        />
      )}
    </Box>
  );
}
