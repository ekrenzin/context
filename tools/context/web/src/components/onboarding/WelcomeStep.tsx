import { useEffect, useState } from "react";
import { Box, Typography, Button } from "@mui/material";

interface Props {
  onBegin: () => void;
}

const LINES = [
  "Your workspace learns from you.",
  "Describe what you need. It builds itself.",
  "Everything stays on your machine.",
];

export function WelcomeStep({ onBegin }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = LINES.map((_, i) =>
      setTimeout(() => setVisibleLines(i + 1), 600 + i * 800),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") onBegin();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBegin]);

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
      }}
    >
      <Typography
        variant="h2"
        sx={{
          fontWeight: 800,
          mb: 5,
          letterSpacing: "-0.03em",
          opacity: 0,
          animation: "story-enter 0.8s ease forwards",
          textAlign: "center",
        }}
      >
        Welcome to Context
      </Typography>

      <Box sx={{ mb: 6, maxWidth: 480 }}>
        {LINES.map((line, i) => (
          <Typography
            key={line}
            variant="h6"
            color="text.secondary"
            sx={{
              fontWeight: 400,
              mb: 1.5,
              textAlign: "center",
              opacity: i < visibleLines ? 1 : 0,
              transform: i < visibleLines ? "translateY(0)" : "translateY(12px)",
              transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {line}
          </Typography>
        ))}
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={onBegin}
        disableElevation
        sx={{
          textTransform: "none",
          fontSize: "1rem",
          px: 5,
          py: 1.5,
          opacity: visibleLines >= LINES.length ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        Begin
      </Button>
    </Box>
  );
}
