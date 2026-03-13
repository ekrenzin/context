import { useMemo } from "react";
import { Box, Typography, Tooltip, useTheme } from "@mui/material";

interface Props {
  activityMap: Record<string, number>;
}

interface DayCell {
  date: string;
  count: number;
  week: number;
  day: number;
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const WEEKS = 26;

function getColor(count: number, max: number, palette: string[]): string {
  if (count === 0) return palette[0];
  const ratio = Math.min(1, count / Math.max(1, max));
  const idx = Math.ceil(ratio * (palette.length - 2));
  return palette[idx];
}

export default function ActivityHeatmap({ activityMap }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const palette = isDark
    ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  const { cells, max, months } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - WEEKS * 7 + 1);
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay());

    const result: DayCell[] = [];
    let maxCount = 0;
    const monthLabels: Array<{ label: string; week: number }> = [];
    let lastMonth = -1;

    const cursor = new Date(start);
    let week = 0;
    while (cursor <= today) {
      const iso = cursor.toISOString().slice(0, 10);
      const count = activityMap[iso] ?? 0;
      if (count > maxCount) maxCount = count;

      const month = cursor.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          label: cursor.toLocaleString("default", { month: "short" }),
          week,
        });
        lastMonth = month;
      }

      result.push({
        date: iso,
        count,
        week,
        day: cursor.getDay(),
      });

      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 0) week++;
    }

    return { cells: result, max: maxCount, months: monthLabels };
  }, [activityMap]);

  const cellSize = 12;
  const gap = 2;
  const labelWidth = 28;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        Activity
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <svg
          width={labelWidth + (WEEKS + 1) * (cellSize + gap)}
          height={8 * (cellSize + gap) + 20}
        >
          {/* Month labels */}
          {months.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.week * (cellSize + gap)}
              y={10}
              fontSize={9}
              fill={theme.palette.text.secondary}
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={20 + i * (cellSize + gap) + cellSize - 2}
              fontSize={9}
              fill={theme.palette.text.secondary}
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {cells.map((cell) => (
            <Tooltip
              key={cell.date}
              title={`${cell.date}: ${cell.count} session${cell.count !== 1 ? "s" : ""}`}
              arrow
            >
              <rect
                x={labelWidth + cell.week * (cellSize + gap)}
                y={20 + cell.day * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(cell.count, max, palette)}
              />
            </Tooltip>
          ))}
        </svg>
      </Box>
    </Box>
  );
}
