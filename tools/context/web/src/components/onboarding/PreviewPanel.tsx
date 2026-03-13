import { Box, Typography, Card, Chip, Stack } from "@mui/material";
import { resolveAccent, resolveSurfaceGradient, type BrandingConfig } from "../../lib/branding";

interface Props {
  config: BrandingConfig;
  mode: "dark" | "light";
}

export function PreviewPanel({ config, mode }: Props) {
  const p = mode === "dark" ? config.dark : config.light;
  const r = config.borderRadius;
  const accent = resolveAccent(config, mode);
  const surfGrad = resolveSurfaceGradient(config, mode);
  const elevation = config.elevation ?? "subtle";
  const isDark = mode === "dark";

  const cardShadow =
    elevation === "flat"
      ? "none"
      : elevation === "raised"
        ? isDark
          ? "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)"
        : isDark
          ? "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)";

  return (
    <Box
      sx={{
        width: "100%",
        borderRadius: `${r}px`,
        overflow: "hidden",
        border: "1px solid",
        borderColor: p.border ?? "divider",
        bgcolor: p.background,
        background: surfGrad ?? undefined,
        p: 2,
        transition: "all 0.4s ease",
      }}
    >
      <Box
        sx={{
          height: 6,
          width: "40%",
          borderRadius: r,
          mb: 1.5,
          background: accent,
        }}
      />

      <Box
        sx={{
          bgcolor: p.surfaceAlt ?? p.surface,
          borderRadius: `${r}px`,
          p: 1,
          mb: 1.5,
          border: "1px solid",
          borderColor: p.border ?? (p.textSecondary + "22"),
        }}
      >
        <Typography sx={{ fontSize: 8, color: p.textMuted ?? p.textSecondary, mb: 0.25 }}>
          Sidebar
        </Typography>
        <Typography sx={{ fontSize: 9, fontWeight: 600, color: p.accent ?? p.primary }}>
          Navigation
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: p.surface,
            borderRadius: `${r}px`,
            p: 1.5,
            border: "1px solid",
            borderColor: p.border ?? (p.textSecondary + "33"),
            boxShadow: cardShadow,
          }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: p.text, mb: 0.5 }}>
            Active agents
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: p.primary }}>
            12
          </Typography>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: p.surface,
            borderRadius: `${r}px`,
            p: 1.5,
            border: "1px solid",
            borderColor: p.border ?? (p.textSecondary + "33"),
            boxShadow: cardShadow,
          }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: p.text, mb: 0.5 }}>
            Solutions
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: p.secondary }}>
            3
          </Typography>
        </Card>
      </Box>

      <Box
        sx={{
          bgcolor: p.highlight ?? (p.primary + "14"),
          borderRadius: `${r}px`,
          p: 0.75,
          mb: 1.5,
          border: "1px solid",
          borderColor: p.border ?? "transparent",
        }}
      >
        <Typography sx={{ fontSize: 9, color: p.tertiary ?? p.secondary, fontWeight: 600 }}>
          Highlighted row
        </Typography>
      </Box>

      <Stack direction="row" spacing={0.75}>
        <Chip
          label="Active"
          size="small"
          sx={{
            background: config.useGradient ? accent : (p.success + "22"),
            color: config.useGradient ? "#fff" : p.success,
            fontSize: 10,
            height: 22,
            borderRadius: `${r / 2}px`,
          }}
        />
        <Chip
          label="Idle"
          size="small"
          sx={{
            bgcolor: p.textSecondary + "22",
            color: p.textSecondary,
            fontSize: 10,
            height: 22,
            borderRadius: `${r / 2}px`,
          }}
        />
      </Stack>
    </Box>
  );
}
