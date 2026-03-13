import { useState, useEffect, useMemo, useCallback } from "react";
import type { SkillGraph } from "../lib/api";
import { api } from "../lib/api";
import { useRefetchOnMqtt } from "./useRefetchOnMqtt";
import type { ElementDefinition } from "cytoscape";

export interface SkillGraphData {
  elements: ElementDefinition[];
  maxDeg: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSkillGraph(): SkillGraphData {
  const [graph, setGraph] = useState<SkillGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { generation, bump } = useRefetchOnMqtt("ctx/tasks/complete");

  useEffect(() => {
    setLoading(true);
    api
      .skillGraph()
      .then(setGraph)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [generation]);

  const refetch = useCallback(() => bump(), [bump]);

  return useMemo(() => {
    if (!graph) return { elements: [], maxDeg: 0, loading, error, refetch };

    const degMap = new Map<string, number>();
    for (const edge of graph.edges) {
      degMap.set(edge.source, (degMap.get(edge.source) ?? 0) + 1);
      degMap.set(edge.target, (degMap.get(edge.target) ?? 0) + 1);
    }
    const maxDeg = Math.max(1, ...degMap.values());

    const elements: ElementDefinition[] = [
      ...graph.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.id,
          category: n.category,
          description: n.description,
          relatedSkills: n.relatedSkills,
          deg: degMap.get(n.id) ?? 0,
        },
      })),
      ...graph.edges.map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          edgeType: e.type,
        },
      })),
    ];

    return { elements, maxDeg, loading, error, refetch };
  }, [graph, loading, error, refetch]);
}
