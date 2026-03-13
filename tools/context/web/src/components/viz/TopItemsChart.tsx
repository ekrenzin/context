import { useTheme } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DataItem {
  name: string;
  value: number;
}

interface Props {
  title: string;
  data: DataItem[];
  color?: string;
  maxItems?: number;
}

export default function TopItemsChart({
  title,
  data,
  color,
  maxItems = 10,
}: Props) {
  const theme = useTheme();
  const barColor = color ?? theme.palette.primary.main;

  const sorted = [...data]
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems);

  if (sorted.length === 0) return null;

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
        {title}
      </div>
      <ResponsiveContainer width="100%" height={sorted.length * 32 + 16}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={barColor} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
