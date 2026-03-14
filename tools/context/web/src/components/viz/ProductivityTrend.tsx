import { useMemo } from "react";
import { useTheme } from "@mui/material";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SessionRecord } from "../../lib/api";

interface Props {
  sessions: SessionRecord[];
}

interface DayBucket {
  date: string;
  productive: number;
  mixed: number;
  struggling: number;
  unanalyzed: number;
}

function useVerdictColors(): Record<string, string> {
  const theme = useTheme();
  return {
    productive: theme.palette.success.main,
    mixed: theme.palette.warning.main,
    struggling: theme.palette.error.main,
    unanalyzed: theme.palette.text.disabled,
  };
}

export default function ProductivityTrend({ sessions }: Props) {
  const theme = useTheme();
  const verdictColors = useVerdictColors();

  const data = useMemo(() => {
    const buckets = new Map<string, DayBucket>();
    for (const s of sessions) {
      const date = s.date;
      if (!buckets.has(date)) {
        buckets.set(date, {
          date,
          productive: 0,
          mixed: 0,
          struggling: 0,
          unanalyzed: 0,
        });
      }
      const b = buckets.get(date)!;
      const v = (s.verdict || "unanalyzed") as keyof Omit<DayBucket, "date">;
      if (v in b) b[v]++;
    }
    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions]);

  if (data.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 8,
          color: theme.palette.text.primary,
        }}
      >
        Session Trend
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          {(["productive", "mixed", "struggling", "unanalyzed"] as const).map(
            (key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={verdictColors[key]}
                fill={verdictColors[key]}
                fillOpacity={0.6}
              />
            ),
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
