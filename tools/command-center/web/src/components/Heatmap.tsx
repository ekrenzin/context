import { Box, Tooltip, Typography, useTheme } from "@mui/material";

interface HeatmapProps {
  activityMap: Record<string, number>;
}

function heatmapSpan(activityMap: Record<string, number>): number {
  const dates = Object.keys(activityMap).filter((k) => activityMap[k] > 0).sort();
  if (dates.length === 0) return 28;
  const earliest = new Date(dates[0]);
  const latest = new Date(dates[dates.length - 1]);
  const span = Math.ceil((latest.getTime() - earliest.getTime()) / 86400000) + 1;
  return Math.ceil(Math.max(28, span + 7) / 7) * 7;
}

export function Heatmap({ activityMap }: HeatmapProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const totalDays = heatmapSpan(activityMap);
  const maxCount = Math.max(1, ...Object.values(activityMap));
  const now = new Date();
  const dayMs = 86400000;

  const levels = isDark
    ? ["#1a1a25", "#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  const cells: Array<{ key: string; date: string; count: number; level: number }> = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    const count = activityMap[key] ?? 0;
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }
    cells.push({ key, date: key, count, level });
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "3px",
          maxWidth: "100%",
        }}
      >
        {cells.map((cell) => (
          <Tooltip key={cell.key} title={`${cell.date}: ${cell.count} sessions`} arrow>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "2px",
                backgroundColor: levels[cell.level],
                transition: "transform 0.1s",
                "&:hover": { transform: "scale(1.3)" },
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
        <Typography variant="caption" color="text.secondary">Less</Typography>
        {levels.map((color, i) => (
          <Box key={i} sx={{ width: 10, height: 10, borderRadius: "2px", backgroundColor: color }} />
        ))}
        <Typography variant="caption" color="text.secondary">More</Typography>
      </Box>
    </Box>
  );
}
