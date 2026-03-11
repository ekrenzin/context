import type { SessionMapNode, SessionMapEdge } from "../lib/api";

const OUTER_RADIUS = 250;
const INNER_RADIUS_SCALE = 10;
const INNER_RADIUS_MIN = 8;

function buildRepoGraph(
  nodes: SessionMapNode[],
  edges: SessionMapEdge[],
): { degree: Map<string, number>; cross: Map<string, Map<string, number>>; nodeCount: Map<string, number> } {
  const nodeRepo = new Map<string, string>();
  const nodeCount = new Map<string, number>();
  for (const n of nodes) {
    const repo = n.repos[0];
    if (repo) {
      nodeRepo.set(n.id, repo);
      nodeCount.set(repo, (nodeCount.get(repo) ?? 0) + 1);
    }
  }

  const degree = new Map<string, number>();
  const cross = new Map<string, Map<string, number>>();

  for (const e of edges) {
    const src = nodeRepo.get(e.source);
    const tgt = nodeRepo.get(e.target);
    if (!src || !tgt) continue;
    degree.set(src, (degree.get(src) ?? 0) + 1);
    degree.set(tgt, (degree.get(tgt) ?? 0) + 1);
    if (src !== tgt) {
      if (!cross.has(src)) cross.set(src, new Map());
      if (!cross.has(tgt)) cross.set(tgt, new Map());
      const srcMap = cross.get(src)!;
      const tgtMap = cross.get(tgt)!;
      srcMap.set(tgt, (srcMap.get(tgt) ?? 0) + e.weight);
      tgtMap.set(src, (tgtMap.get(src) ?? 0) + e.weight);
    }
  }

  return { degree, cross, nodeCount };
}

function greedyAngularOrder(
  repos: string[],
  cross: Map<string, Map<string, number>>,
): string[] {
  if (repos.length <= 2) return repos;

  const remaining = new Set(repos);
  const ordered: string[] = [];

  const first = repos.reduce((best, r) => {
    const bestWeight = [...(cross.get(best)?.values() ?? [])].reduce((a, b) => a + b, 0);
    const rWeight = [...(cross.get(r)?.values() ?? [])].reduce((a, b) => a + b, 0);
    return rWeight > bestWeight ? r : best;
  });
  ordered.push(first);
  remaining.delete(first);

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    const lastConns = cross.get(last);
    let bestNext = "";
    let bestWeight = -1;
    for (const r of remaining) {
      const w = lastConns?.get(r) ?? 0;
      if (w > bestWeight || bestNext === "") {
        bestWeight = w;
        bestNext = r;
      }
    }
    ordered.push(bestNext);
    remaining.delete(bestNext);
  }

  return ordered;
}

export function repoClusterCenters(
  nodes: SessionMapNode[],
  edges: SessionMapEdge[],
): Map<string, { x: number; y: number }> {
  const repos = [...new Set(nodes.flatMap((n) => n.repos))].filter(Boolean);
  const centers = new Map<string, { x: number; y: number }>();
  if (repos.length === 0) return centers;

  const { degree, cross, nodeCount } = buildRepoGraph(nodes, edges);

  const centerRepo = repos.reduce((best, r) => {
    const bestDeg = degree.get(best) ?? 0;
    const rDeg = degree.get(r) ?? 0;
    if (rDeg !== bestDeg) return rDeg > bestDeg ? r : best;
    return (nodeCount.get(r) ?? 0) > (nodeCount.get(best) ?? 0) ? r : best;
  });

  centers.set(centerRepo, { x: 0, y: 0 });

  const ring = repos.filter((r) => r !== centerRepo);
  if (ring.length === 0) return centers;

  const ordered = greedyAngularOrder(ring, cross);
  const centerConns = cross.get(centerRepo) ?? new Map<string, number>();
  const maxConn = Math.max(1, ...[...centerConns.values()]);

  ordered.forEach((repo, i) => {
    const angle = (2 * Math.PI * i) / ordered.length;
    const conn = centerConns.get(repo) ?? 0;
    const closeness = maxConn > 0 ? conn / maxConn : 0;
    const radius = OUTER_RADIUS * (1 - closeness * 0.45);
    centers.set(repo, {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  });

  return centers;
}

export function circlePackLayout(
  nodes: SessionMapNode[],
  repoCenters: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const repoGroups = new Map<string, SessionMapNode[]>();
  for (const n of nodes) {
    const repo = n.repos[0] ?? "";
    const group = repoGroups.get(repo) ?? [];
    group.push(n);
    repoGroups.set(repo, group);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [repo, repoNodes] of repoGroups) {
    const center = repoCenters.get(repo) ?? { x: 0, y: 0 };
    const r = Math.max(INNER_RADIUS_MIN, Math.sqrt(repoNodes.length) * INNER_RADIUS_SCALE);
    repoNodes.forEach((n, i) => {
      if (repoNodes.length === 1) {
        positions.set(n.id, { x: center.x, y: center.y });
      } else {
        const angle = (2 * Math.PI * i) / repoNodes.length;
        positions.set(n.id, {
          x: center.x + r * Math.cos(angle),
          y: center.y + r * Math.sin(angle),
        });
      }
    });
  }
  return positions;
}
