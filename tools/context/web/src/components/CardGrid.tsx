import type { ReactNode } from "react";
import { Box } from "@mui/material";

interface CardGridProps {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
}

export function CardGrid({ children, minWidth = 280, gap = 2 }: CardGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`,
        gap,
        alignItems: "stretch",
      }}
    >
      {children}
    </Box>
  );
}
