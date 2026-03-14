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
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Example {
  problem: string;
  name: string;
  persona: string;
  icon: string;
}

type CliTool = "claude" | "codex";

interface Props {
  persona: "non-technical" | "power-user";
  availableTools: { claude: boolean; codex: boolean };
  onPropose: (problem: string, name: string, tool: CliTool) => void;
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

export function ProblemStep({ persona, availableTools, onPropose, onBack }: Props) {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freeform, setFreeform] = useState("");

  const defaultTool: CliTool = availableTools.claude ? "claude" : "codex";
  const [tool, setTool] = useState<CliTool>(defaultTool);
  const bothAvailable = availableTools.claude && availableTools.codex;

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

  function submit(problem: string, name: string) {
    onPropose(problem, name, tool);
  }

  function handleFreeformSubmit() {
    const text = freeform.trim();
    if (!text) return;
    submit(text, toKebab(text));
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
        Pick one below, or describe your own. We'll create a proposal you can build from.
      </Typography>

      {bothAvailable && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Generate with:
          </Typography>
          <ToggleButtonGroup
            value={tool}
            exclusive
            onChange={(_, v) => v && setTool(v)}
            size="small"
          >
            <ToggleButton value="claude">Claude Code</ToggleButton>
            <ToggleButton value="codex">Codex</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

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
                onClick={() => submit(ex.problem, ex.name)}
                sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="body1" sx={{ flex: 1 }}>{ex.problem}</Typography>
                <Button
                  size="small"
                  variant="text"
                  sx={{ ml: 2, textTransform: "none", pointerEvents: "none" }}
                >
                  Go
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
