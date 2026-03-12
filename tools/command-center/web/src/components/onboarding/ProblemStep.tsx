import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Example {
  problem: string;
  name: string;
  persona: string;
  icon: string;
}

interface Props {
  persona: "non-technical" | "power-user";
  onSolve: (problem: string, name: string) => void;
  onBack: () => void;
}

const TITLES: Record<string, string> = {
  "non-technical": "What's something your team deals with every week?",
  "power-user": "What's a recurring pain point in your workflow?",
};

function toKebab(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 3)
    .join("-")
    .replace(/[^a-z0-9-]/g, "");
}

export function ProblemStep({ persona, onSolve, onBack }: Props) {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freeform, setFreeform] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/solutions/examples");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Example[] = await res.json();
        if (!cancelled) setExamples(data.filter((e) => e.persona === persona));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [persona]);

  function handleFreeformSubmit() {
    const text = freeform.trim();
    if (!text) return;
    onSolve(text, toKebab(text));
  }

  return (
    <Box sx={{ maxWidth: 560, mx: "auto", py: 6, px: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, textTransform: "none" }}>
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        {TITLES[persona]}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Pick one below, or describe your own.
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && (
        <Stack spacing={1.5} sx={{ mb: 4 }}>
          {examples.map((ex) => (
            <Card key={ex.name} variant="outlined">
              <CardActionArea
                onClick={() => onSolve(ex.problem, ex.name)}
                sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="body1" sx={{ flex: 1 }}>{ex.problem}</Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ ml: 2, textTransform: "none", pointerEvents: "none" }}
                >
                  Solve This
                </Button>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Or describe your own...
      </Typography>

      <Stack direction="row" spacing={1.5}>
        <TextField
          value={freeform}
          onChange={(e) => setFreeform(e.target.value)}
          placeholder="e.g. Track who approved what and when"
          multiline
          rows={2}
          fullWidth
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleFreeformSubmit();
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleFreeformSubmit}
          disabled={!freeform.trim()}
          disableElevation
          sx={{ alignSelf: "flex-end" }}
        >
          Go
        </Button>
      </Stack>
    </Box>
  );
}
