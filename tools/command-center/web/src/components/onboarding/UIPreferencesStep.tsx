import { useState } from "react";
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
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { StoryPage } from "./StoryPage";
import { PreviewPanel } from "./PreviewPanel";
import { MOOD_PRESETS, type MoodPreset } from "./presets";
import { DEFAULT_BRANDING, type BrandingConfig } from "../../lib/branding";

interface Props {
  onComplete: (config: BrandingConfig) => void;
  onBack: () => void;
  onPreview?: (config: BrandingConfig) => void;
}

async function persistBranding(config: BrandingConfig): Promise<void> {
  await fetch("/api/branding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

async function generateFromDescription(description: string): Promise<BrandingConfig> {
  const res = await fetch("/api/onboarding/ui-preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
  const data = await res.json();
  return data.config;
}

function MoodCard({ preset, active, onSelect }: {
  preset: MoodPreset;
  active: boolean;
  onSelect: () => void;
}) {
  const p = preset.config.dark;
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: active ? p.primary : "divider",
        borderWidth: active ? 2 : 1,
        transition: "all 0.25s ease",
        transform: active ? "scale(1.03)" : "scale(1)",
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {[p.primary, p.secondary, p.background].map((c) => (
              <Box
                key={c}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "6px",
                  bgcolor: c,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={600}>{preset.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {preset.description}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export function UIPreferencesStep({ onComplete, onBack, onPreview }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [freeform, setFreeform] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePresetSelect(preset: MoodPreset) {
    setSelected(preset.id);
    setPreview(preset.config);
    setError(null);
    onPreview?.(preset.config);
  }

  async function handleGenerate() {
    if (!freeform.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const config = await generateFromDescription(freeform.trim());
      setPreview(config);
      setSelected("custom");
      onPreview?.(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleContinue() {
    await persistBranding(preview);
    onComplete(preview);
  }

  return (
    <StoryPage
      title="Describe your ideal workspace"
      subtitle="Pick a mood or tell us what you want. The UI reshapes itself to match."
      onBack={onBack}
    >
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Mood
          </Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            {MOOD_PRESETS.map((p) => (
              <MoodCard
                key={p.id}
                preset={p}
                active={selected === p.id}
                onSelect={() => handlePresetSelect(p)}
              />
            ))}
          </Stack>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Or describe it
          </Typography>
          <TextField
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            placeholder='e.g. "Sleek dark theme with warm orange accents and sharp corners"'
            multiline
            rows={3}
            fullWidth
            sx={{ mb: 1.5 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleGenerate}
            disabled={!freeform.trim() || generating}
            startIcon={generating ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            sx={{ textTransform: "none", mb: 2 }}
          >
            {generating ? "Generating..." : "Generate from description"}
          </Button>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>

        <Box sx={{ flex: "0 0 220px" }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Preview
          </Typography>
          <PreviewPanel config={preview} mode="dark" />
          <Box sx={{ mt: 1.5 }}>
            <PreviewPanel config={preview} mode="light" />
          </Box>
        </Box>
      </Box>

      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={handleContinue}
        disabled={!selected}
        disableElevation
        sx={{ mt: 4 }}
      >
        Continue
      </Button>
    </StoryPage>
  );
}
