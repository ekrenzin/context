import { Chip } from "@mui/material";

const VERDICT_COLORS: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  productive: "success",
  mixed: "warning",
  struggling: "error",
  blocked: "info",
};

interface VerdictChipProps {
  verdict: string;
  size?: "small" | "medium";
}

export function VerdictChip({ verdict, size = "small" }: VerdictChipProps) {
  if (!verdict) return null;
  const color = VERDICT_COLORS[verdict] ?? "default";
  return <Chip label={verdict} color={color} size={size} variant="outlined" />;
}
