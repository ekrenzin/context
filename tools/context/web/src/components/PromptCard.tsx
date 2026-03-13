import { useRef } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  Chip,
  Box,
  Slider,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

const PRESETS = [
  { label: "Name a feature", prompt: "Suggest 5 creative names for a feature that" },
  { label: "Draft commit msg", prompt: "Write a concise git commit message for:" },
  { label: "Explain error", prompt: "Explain this error in one sentence:" },
  { label: "PR title", prompt: "Write a short PR title for:" },
  { label: "Brainstorm", prompt: "Give me 5 ideas for:" },
];

interface Props {
  prompt: string;
  onPromptChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
  maxTokens: number;
  onMaxTokensChange: (v: number) => void;
  temperature: number;
  onTemperatureChange: (v: number) => void;
}

export function PromptCard({
  prompt, onPromptChange, onSend, sending, disabled,
  maxTokens, onMaxTokensChange, temperature, onTemperatureChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Prompt
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            placeholder={disabled ? "Model is offline" : "Ask the local model anything..."}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={disabled || sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
            }}
            size="small"
          />
          <Button
            variant="contained"
            onClick={onSend}
            disabled={disabled || sending || !prompt.trim()}
            disableElevation
            sx={{ minWidth: 48, alignSelf: "flex-end" }}
          >
            {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          </Button>
        </Stack>

        <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Max tokens: {maxTokens}
            </Typography>
            <Slider
              value={maxTokens}
              onChange={(_, v) => onMaxTokensChange(v as number)}
              min={20} max={500} step={10} size="small"
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Temperature: {temperature.toFixed(1)}
            </Typography>
            <Slider
              value={temperature}
              onChange={(_, v) => onTemperatureChange(v as number)}
              min={0} max={1} step={0.1} size="small"
            />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              size="small"
              variant="outlined"
              onClick={() => { onPromptChange(p.prompt + " "); inputRef.current?.focus(); }}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
