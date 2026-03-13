import { type ReactNode } from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  visible?: boolean;
}

export function StoryPage({ title, subtitle, children, onBack, onSkip, visible = true }: Props) {
  if (!visible) return null;

  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 6,
        position: "relative",
      }}
    >

      {onSkip && (
        <Button
          onClick={onSkip}
          sx={{
            position: "absolute",
            top: 24,
            right: 24,
            textTransform: "none",
            color: "text.secondary",
            fontSize: "0.875rem",
          }}
        >
          Skip
        </Button>
      )}

      <Box
        sx={{
          width: "100%",
          maxWidth: 640,
          animation: "story-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {onBack && (
          <IconButton onClick={onBack} sx={{ mb: 2, ml: -1 }} size="small">
            <ArrowBackIcon />
          </IconButton>
        )}

        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: subtitle ? 1.5 : 4,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 5, fontSize: "1.125rem", lineHeight: 1.6, maxWidth: 520 }}
          >
            {subtitle}
          </Typography>
        )}

        {children}
      </Box>
    </Box>
  );
}
