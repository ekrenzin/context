import type { ReactNode } from "react";
import { Box, Typography, Stack } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: number | false;
  title?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
}

export function PageLayout({
  children,
  maxWidth = false,
  title,
  icon,
  badge,
  actions,
  sx,
}: PageLayoutProps) {
  return (
    <Box
      sx={{
        pt: 2,
        ...(maxWidth && { maxWidth, mx: "auto" }),
        ...sx,
      }}
    >
      {title && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          {icon}
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          {badge}
          <Box sx={{ flex: 1 }} />
          {actions}
        </Stack>
      )}
      {children}
    </Box>
  );
}
