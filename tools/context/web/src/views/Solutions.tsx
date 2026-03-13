import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  Box,
  Card,
  Typography,
  Stack,
  Skeleton,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import { CardGrid } from "../components/CardGrid";
import { PageLayout } from "../components/PageLayout";
import { SolutionCard } from "../components/solutions/SolutionCard";
import { SolutionEmptyState } from "../components/solutions/EmptyState";

const Proposals = lazy(() => import("./Proposals"));

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${res.status}`);
  return res.json();
}

const TAB_KEYS = ["solutions", "proposals"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function SolutionsList() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<Solution[]>("/api/solutions").then(setSolutions)
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

export default function Solutions({ embedded }: { embedded?: boolean }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [params, setParams] = useSearchParams();

  if (embedded) {
    return <SolutionsList />;
  }

  const raw = params.get("tab") as TabKey | null;
  const tab = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : "solutions";
  const tabIndex = TAB_KEYS.indexOf(tab);

  return (
    <PageLayout title="Solutions" icon={<LightbulbIcon color="primary" />}>
      <Tabs
        value={tabIndex}
        onChange={(_, idx) => setParams({ tab: TAB_KEYS[idx] })}
        sx={{ mb: 2 }}
      >
        <Tab label="Solutions" />
        <Tab label="Proposals" />
      </Tabs>

      <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}>
        {tab === "solutions" && <SolutionsList />}
        {tab === "proposals" && <Proposals />}
      </Suspense>
    </PageLayout>
  );
}
