import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Stack,
  Alert,
  CircularProgress,
} from "@mui/material";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import { CardGrid } from "../CardGrid";

interface SolutionExample {
  problem: string;
  name: string;
  persona: string;
  icon: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url}: ${res.status}`);
  return res.json();
}

export function SolutionEmptyState({ onCreated }: { onCreated: () => void }) {
  const [problem, setProblem] = useState("");
  const [name, setName] = useState("");
  const [examples, setExamples] = useState<SolutionExample[]>([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SolutionExample[]>("/api/solutions/examples").then(setExamples).catch(() => {});
  }, []);

  async function build(p: string, n: string) {
    setBuilding(true);
    setError(null);
    try {
      await fetchJson("/api/solutions/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: p, name: n }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Box sx={{ textAlign: "center", py: 8, maxWidth: 560, mx: "auto" }}>
      <LightbulbIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>What problem can we solve?</Typography>
      <Stack spacing={2} sx={{ mt: 3 }}>
        <TextField fullWidth label="Describe the problem" value={problem}
          onChange={(e) => setProblem(e.target.value)} multiline minRows={2} />
        <TextField fullWidth label="Solution name" value={name}
          onChange={(e) => setName(e.target.value)} />
        <Button variant="contained" size="large" disabled={!problem.trim() || !name.trim() || building}
          onClick={() => build(problem, name)}>
          {building ? <CircularProgress size={22} sx={{ mr: 1 }} /> : null}
          Solve It
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {examples.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Or try an example</Typography>
          <CardGrid minWidth={220} gap={1.5}>
            {examples.map((ex) => (
              <Box key={ex.name}>
                <Card variant="outlined" sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
                  onClick={() => { setProblem(ex.problem); setName(ex.name); }}>
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>{ex.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{ex.problem}</Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </CardGrid>
        </Box>
      )}
    </Box>
  );
}
