import { Box, Typography, CircularProgress, Stack } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Props {
  status: string;
}

const STEPS = [
  "Understanding your problem...",
  "Designing the solution...",
  "Building what you need...",
  "Starting up...",
];

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.toLowerCase().includes(status.toLowerCase().slice(0, 12)));
  if (idx >= 0) return idx;
  if (status.toLowerCase().includes("understand")) return 0;
  if (status.toLowerCase().includes("design")) return 1;
  if (status.toLowerCase().includes("build") || status.toLowerCase().includes("component")) return 2;
  if (status.toLowerCase().includes("assembl") || status.toLowerCase().includes("start")) return 3;
  return 0;
}

export function BuildingStep({ status }: Props) {
  const current = stepIndex(status);

  return (
    <Box
      sx={{
        maxWidth: 420,
        mx: "auto",
        py: 10,
        px: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <CircularProgress size={48} sx={{ mb: 4 }} />

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, textAlign: "center" }}>
        Building your solution
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 5, textAlign: "center" }}>
        {status || STEPS[0]}
      </Typography>

      <Stack spacing={1.5} sx={{ width: "100%" }}>
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <Box key={step} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {done && <CheckCircleIcon color="success" fontSize="small" />}
              {active && <CircularProgress size={18} />}
              {!done && !active && (
                <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid", borderColor: "divider" }} />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: active ? 600 : 400,
                  color: done ? "success.main" : active ? "text.primary" : "text.secondary",
                }}
              >
                {step}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
