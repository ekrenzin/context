import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  TextField,
  IconButton,
  Collapse,
  CircularProgress,
  Box,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { api, type ProjectRecord } from "../lib/api";

interface Props {
  project: ProjectRecord;
}

const ACTIONS = [
  {
    label: "PR title",
    build: (p: ProjectRecord) =>
      `Write a short PR title for recent work on ${p.name}. Reply with ONLY the title.`,
  },
  {
    label: "Branch name",
    build: (p: ProjectRecord) =>
      `Suggest a git branch name for work on ${p.name}. Reply with ONLY the branch name (kebab-case).`,
  },
  {
    label: "Describe project",
    build: (p: ProjectRecord) =>
      `Write a one-sentence description for a project called "${p.name}" at ${p.root_path}. Reply with ONLY the description.`,
  },
  {
    label: "Session name",
    build: (p: ProjectRecord) =>
      `Name a terminal session for working on ${p.name} in 2-3 creative words. Reply with ONLY the name.`,
  },
];

export function AiActionsCard({ project }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  async function run(prompt: string) {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.localAiPrompt(prompt, { maxTokens: 100 });
      setResult(res.ok ? res.response ?? "(empty)" : res.error ?? "Failed");
    } catch {
      setResult("Local AI unavailable");
    }
    setLoading(false);
  }

  function sendCustom() {
    const text = customPrompt.trim();
    if (!text) return;
    run(`Project: ${project.name} (${project.root_path})\n\n${text}`);
    setCustomPrompt("");
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          onClick={() => setExpanded(!expanded)}
          sx={{ cursor: "pointer" }}
        >
          <SmartToyIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            AI Actions
          </Typography>
          <Chip label="Local" size="small" variant="outlined" />
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Stack>

        <Collapse in={expanded}>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {ACTIONS.map((a) => (
              <Chip
                key={a.label}
                label={a.label}
                size="small"
                variant="outlined"
                onClick={() => run(a.build(project))}
                disabled={loading}
                sx={{ cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Ask about this project..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); sendCustom(); }
              }}
            />
            <IconButton
              size="small"
              onClick={sendCustom}
              disabled={loading || !customPrompt.trim()}
            >
              {loading ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Stack>

          {result && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 1,
                bgcolor: "action.hover",
                whiteSpace: "pre-wrap",
              }}
            >
              <Typography variant="body2">{result}</Typography>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}
