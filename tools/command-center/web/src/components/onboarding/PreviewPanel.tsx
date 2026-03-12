import { Box, Typography, Card, Chip, Stack } from "@mui/material";
import type { BrandingConfig } from "../../lib/branding";

interface Props {
  config: BrandingConfig;
  mode: "dark" | "light";
}

export function PreviewPanel({ config, mode }: Props) {
  const p = mode === "dark" ? config.dark : config.light;
  const r = config.borderRadius;

  return (
    <Box
      sx={{
        width: "100%",
        borderRadius: `${r}px`,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: p.background,
        p: 2,
        transition: "all 0.4s ease",
      }}
    >
      <Box
        sx={{
          height: 6,
          width: "40%",
          borderRadius: r,
          mb: 2,
          background: config.accentGradient,
        }}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: p.surface,
            borderRadius: `${r}px`,
            p: 1.5,
            border: "none",
            boxShadow: "none",
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
            border: "none",
            boxShadow: "none",
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

      <Stack direction="row" spacing={0.75}>
        <Chip
          label="Running"
          size="small"
          sx={{
            bgcolor: p.success + "22",
            color: p.success,
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
