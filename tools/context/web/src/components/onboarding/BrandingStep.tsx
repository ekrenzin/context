import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardActionArea,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

interface Palette {
  label: string;
  colors: [string, string, string];
}

const PALETTES: Palette[] = [
  { label: "Midnight", colors: ["#3b82f6", "#6366f1", "#a78bfa"] },
  { label: "Redwood", colors: ["#5b7a3a", "#8b6914", "#a0522d"] },
  { label: "Ember", colors: ["#d97706", "#c2410c", "#f97316"] },
  { label: "Neon", colors: ["#a855f7", "#ec4899", "#6366f1"] },
  { label: "Mono", colors: ["#374151", "#6b7280", "#9ca3af"] },
  { label: "Ocean", colors: ["#0891b2", "#0d9488", "#2dd4bf"] },
  { label: "Aurora", colors: ["#10b981", "#8b5cf6", "#38bdf8"] },
  { label: "Rose", colors: ["#e11d48", "#f472b6", "#e879a8"] },
  { label: "Copper", colors: ["#b45309", "#a16207", "#e8a85a"] },
  { label: "Arctic", colors: ["#38bdf8", "#bae6fd", "#0284c7"] },
  { label: "Sage", colors: ["#6b8a6e", "#8faa8e", "#4a6e4c"] },
  { label: "Obsidian", colors: ["#6366f1", "#4f46e5", "#818cf8"] },
];

function Swatch({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        bgcolor: color,
        border: "2px solid",
        borderColor: "divider",
      }}
    />
  );
}

export function BrandingStep({ onComplete, onBack }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState({ primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" });
  const [saving, setSaving] = useState(false);

  async function applyPalette(primary: string, secondary: string, accent: string) {
    setSaving(true);
    const body: Record<string, unknown> = {
      accentGradient: `linear-gradient(135deg, ${primary}, ${accent})`,
      useGradient: true,
      dark: { primary, secondary },
      light: { primary, secondary },
    };
    if (name.trim()) body.name = name.trim();

    await fetch("/api/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
  }

  async function handleSelectPalette(p: Palette) {
    setSelected(p.label);
    await applyPalette(p.colors[0], p.colors[1], p.colors[2]);
  }

  async function handleContinue() {
    if (selected === "Custom") {
      await applyPalette(custom.primary, custom.secondary, custom.accent);
    } else if (name.trim() && !selected) {
      await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
    }
    onComplete();
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 6, px: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, textTransform: "none" }}>
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Make it yours
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Pick a name and color palette for your workspace.
      </Typography>

      <TextField
        label="What should we call this?"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        placeholder="My Workspace"
        sx={{ mb: 4 }}
      />

      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Color palette
      </Typography>

      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {PALETTES.map((p) => (
          <Card
            key={p.label}
            variant="outlined"
            sx={{
              borderColor: selected === p.label ? "primary.main" : "divider",
              borderWidth: selected === p.label ? 2 : 1,
              transition: "border-color 0.2s",
            }}
          >
            <CardActionArea
              onClick={() => handleSelectPalette(p)}
              sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-start" }}
            >
              <Box sx={{ display: "flex", gap: 0.75 }}>
                {p.colors.map((c) => <Swatch key={c} color={c} />)}
              </Box>
              <Typography variant="body2" fontWeight={500}>{p.label}</Typography>
            </CardActionArea>
          </Card>
        ))}

        <Card
          variant="outlined"
          sx={{
            borderColor: selected === "Custom" ? "primary.main" : "divider",
            borderWidth: selected === "Custom" ? 2 : 1,
            p: 2,
          }}
        >
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{ mb: 1.5, cursor: "pointer" }}
            onClick={() => setSelected("Custom")}
          >
            Custom
          </Typography>
          {selected === "Custom" && (
            <Stack direction="row" spacing={2}>
              <TextField
                label="Primary"
                size="small"
                type="color"
                value={custom.primary}
                onChange={(e) => setCustom((c) => ({ ...c, primary: e.target.value }))}
                sx={{ width: 100 }}
              />
              <TextField
                label="Secondary"
                size="small"
                type="color"
                value={custom.secondary}
                onChange={(e) => setCustom((c) => ({ ...c, secondary: e.target.value }))}
                sx={{ width: 100 }}
              />
              <TextField
                label="Accent"
                size="small"
                type="color"
                value={custom.accent}
                onChange={(e) => setCustom((c) => ({ ...c, accent: e.target.value }))}
                sx={{ width: 100 }}
              />
            </Stack>
          )}
        </Card>
      </Stack>

      <Button
        variant="contained"
        fullWidth
        onClick={handleContinue}
        disabled={saving}
        disableElevation
      >
        Continue
      </Button>
    </Box>
  );
}
