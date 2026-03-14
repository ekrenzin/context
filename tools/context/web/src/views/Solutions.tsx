import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  Typography,
  Stack,
  Skeleton,
  Alert,
} from "@mui/material";
import { CardGrid } from "../components/CardGrid";
import { SolutionCard } from "../components/solutions/SolutionCard";
import { SolutionEmptyState } from "../components/solutions/EmptyState";

interface Solution {
  id: string;
  name: string;
  problem: string;
  description: string;
  proposal: string;
  project_id: string | null;
  status: string;
  components: Array<{ type: string }>;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function Solutions() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/solutions")
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/solutions: ${r.status}`);
        return r.json() as Promise<Solution[]>;
      })
      .then(setSolutions)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <Box sx={{ pt: 1 }}>
      <Skeleton variant="rounded" height={80} sx={{ mb: 3 }} />
      <CardGrid>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i}>
            <Skeleton variant="rounded" height={120} />
          </Box>
        ))}
      </CardGrid>
    </Box>
  );
  if (error) return <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>;
  if (solutions.length === 0) return <SolutionEmptyState onCreated={load} />;

  const activeCount = solutions.filter((s) => s.status === "active").length;
  const totalUsage = solutions.reduce((sum, s) => sum + (s.usage_count ?? 0), 0);

  return (
    <Box sx={{ pt: 1 }}>
      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" spacing={4}>
          <Box>
            <Typography variant="h4" fontWeight={700}>{activeCount}</Typography>
            <Typography variant="body2" color="text.secondary">Active Solutions</Typography>
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>{totalUsage}</Typography>
            <Typography variant="body2" color="text.secondary">Total Uses</Typography>
          </Box>
        </Stack>
      </Card>

      <CardGrid>
        {solutions.map((sol) => (
          <Box key={sol.id}>
            <SolutionCard sol={sol} onAction={load} />
          </Box>
        ))}
      </CardGrid>
    </Box>
  );
}
