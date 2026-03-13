import { Typography, Chip, Stack, Paper } from "@mui/material";
import type { SessionMapNode } from "../../lib/api";

const VERDICT_COLORS: Record<string, "success" | "warning" | "error" | "default"> = {
  productive: "success",
  mixed: "warning",
  struggling: "error",
  unanalyzed: "default",
};

interface Props {
  node: SessionMapNode;
}

export default function SessionTooltip({ node }: Props) {
  return (
    <Paper
      elevation={4}
      sx={{
        p: 1.5,
        maxWidth: 280,
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} noWrap>
        {node.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {node.date}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
        <Chip
          label={node.verdict}
          size="small"
          color={VERDICT_COLORS[node.verdict] ?? "default"}
          sx={{ fontSize: "0.6rem" }}
        />
        {node.skills.slice(0, 4).map((s) => (
          <Chip
            key={s}
            label={s}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.6rem" }}
          />
        ))}
        {node.repos.slice(0, 2).map((r) => (
          <Chip
            key={r}
            label={r}
            size="small"
            variant="outlined"
            color="info"
            sx={{ fontSize: "0.6rem" }}
          />
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
        {node.totalCalls} calls / {node.userTurns} turns
      </Typography>
    </Paper>
  );
}
