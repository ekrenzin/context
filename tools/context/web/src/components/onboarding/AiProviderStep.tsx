import { useState } from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ProviderCard, type ProviderId } from "./ProviderCard";

const PROVIDERS: Array<{ id: ProviderId; label: string; placeholder: string }> = [
  { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI (Codex)", placeholder: "sk-..." },
];

interface Props {
  onComplete: (provider?: string) => void;
  onBack: () => void;
}

export function AiProviderStep({ onComplete, onBack }: Props) {
  const [connected, setConnected] = useState<Set<ProviderId>>(new Set());

  function markConnected(id: ProviderId) {
    setConnected((prev) => new Set(prev).add(id));
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 6, px: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, textTransform: "none" }}>
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Connect your AI providers
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Add any providers you'd like. Everything stays on your machine.
      </Typography>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            id={p.id}
            label={p.label}
            placeholder={p.placeholder}
            connected={connected.has(p.id)}
            onConnected={() => markConnected(p.id)}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => onComplete()} sx={{ textTransform: "none" }}>
          Skip for now
        </Button>
        <Button
          variant="contained"
          onClick={() => onComplete()}
          disabled={connected.size === 0}
          disableElevation
        >
          Continue
        </Button>
      </Stack>
    </Box>
  );
}
