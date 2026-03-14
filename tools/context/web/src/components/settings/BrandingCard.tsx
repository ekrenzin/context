import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  CardActionArea,
  TextField,
  Button,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { MOOD_PRESETS, type MoodPreset } from "../onboarding/presets";
import { PreviewPanel } from "../onboarding/PreviewPanel";
import { useColorMode } from "../../hooks/useColorMode";
import { useBranding, useSetBranding, type BrandingConfig, type ElevationLevel } from "../../lib/branding";

function MoodSwatch({ preset, active, onSelect }: {
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
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {[p.primary, p.secondary, p.background].map((c) => (
              <Box
                key={c}
                sx={{
                  width: 20, height: 20, borderRadius: "5px",
                  bgcolor: c, border: "1px solid rgba(255,255,255,0.1)",
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

function activePresetId(current: BrandingConfig): string | null {
  const match = MOOD_PRESETS.find(
    (p) => p.config.dark.primary === current.dark.primary
      && p.config.dark.background === current.dark.background,
  );
  return match?.id ?? null;
}

export function BrandingCard() {
  const current = useBranding();
  const setBranding = useSetBranding();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const [selected, setSelected] = useState<string | null>(() => activePresetId(current));
  const [preview, setPreview] = useState<BrandingConfig>(current);
  const [freeform, setFreeform] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handlePresetSelect(preset: MoodPreset) {
    setSelected(preset.id);
    setPreview(preset.config);
    setError(null);
    window.__CTX_BRANDING__ = preset.config;
    setBranding(preset.config);
    try {
      await persistBranding(preset.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function applyAndSave(next: BrandingConfig) {
    setPreview(next);
    window.__CTX_BRANDING__ = next;
    setBranding(next);
    persistBranding(next).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }).catch((err) => setError(err instanceof Error ? err.message : "Save failed"));
  }

  async function handleGenerate() {
    if (!freeform.trim()) return;
    setGenerating(true);
    setError(null);
    setSaved(false);
    try {
      const config = await generateFromDescription(freeform.trim());
      setPreview(config);
      setSelected("custom");
      window.__CTX_BRANDING__ = config;
      setBranding(config);
      await persistBranding(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Theme</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pick a mood, describe your own, or generate one with AI. Changes preview instantly.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
              Mode
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              Light or dark base
            </Typography>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={() => toggleColorMode()}
              size="small"
              fullWidth
            >
              <ToggleButton value="light" sx={{ gap: 0.5 }}>
                <LightModeIcon sx={{ fontSize: 16 }} /> Light
              </ToggleButton>
              <ToggleButton value="dark" sx={{ gap: 0.5 }}>
                <DarkModeIcon sx={{ fontSize: 16 }} /> Dark
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
              Depth
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              Shadow intensity on cards
            </Typography>
            <ToggleButtonGroup
              value={preview.elevation ?? "subtle"}
              exclusive
              onChange={(_e, val) => {
                if (!val) return;
                const next = { ...preview, elevation: val as ElevationLevel };
                applyAndSave(next);
              }}
              size="small"
              fullWidth
            >
              {(["flat", "subtle", "raised"] as const).map((level) => (
                <ToggleButton key={level} value={level} sx={{ gap: 0.75, textTransform: "capitalize" }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: "3px",
                      bgcolor: "text.secondary",
                      opacity: 0.25,
                      boxShadow:
                        level === "flat"
                          ? "none"
                          : level === "subtle"
                            ? "0 1px 3px rgba(0,0,0,0.3)"
                            : "0 3px 8px rgba(0,0,0,0.5)",
                    }}
                  />
                  {level}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
              Accent
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              Button and highlight style
            </Typography>
            <ToggleButtonGroup
              value={preview.useGradient ? "gradient" : "solid"}
              exclusive
              onChange={(_e, val) => {
                if (!val) return;
                const next = { ...preview, useGradient: val === "gradient" };
                applyAndSave(next);
              }}
              size="small"
              fullWidth
            >
              <ToggleButton value="solid" sx={{ gap: 0.75 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: "3px",
                    bgcolor: preview[mode].primary,
                  }}
                />
                Solid
              </ToggleButton>
              <ToggleButton value="gradient" sx={{ gap: 0.75 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: "3px",
                    background: preview.accentGradient,
                  }}
                />
                Gradient
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Theme saved</Alert>}

        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {MOOD_PRESETS.map((p) => (
                <MoodSwatch
                  key={p.id}
                  preset={p}
                  active={selected === p.id}
                  onSelect={() => handlePresetSelect(p)}
                />
              ))}
            </Stack>

            <TextField
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              placeholder='e.g. "Warm orange with sharp corners"'
              multiline
              rows={2}
              fullWidth
              size="small"
              sx={{ mb: 1 }}
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
              sx={{ textTransform: "none" }}
            >
              {generating ? "Generating..." : "Generate from description"}
            </Button>
          </Box>

          <Box sx={{ flex: "0 0 200px" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              Preview
            </Typography>
            <PreviewPanel config={preview} mode="dark" />
            <Box sx={{ mt: 1 }}>
              <PreviewPanel config={preview} mode="light" />
            </Box>
          </Box>
        </Box>

      </CardContent>
    </Card>
  );
}
