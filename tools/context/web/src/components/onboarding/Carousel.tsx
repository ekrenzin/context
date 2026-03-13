import { useState, useCallback, useEffect } from "react";
import { Box, Typography, IconButton, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface Props {
  onComplete: () => void;
}

const SLIDES = [
  {
    title: "Your projects learn from you",
    subtitle: "Rules, skills, and memory that evolve from how you work",
  },
  {
    title: "Describe it. It builds itself.",
    subtitle: "Need a tool? Say what it should do. Watch it appear.",
  },
  {
    title: "Everything stays on your machine",
    subtitle: "Your data, your intelligence, your control. Always local.",
  },
];

export function Carousel({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  const next = useCallback(() => {
    if (index === last) {
      onComplete();
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, last, onComplete]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <Button
        onClick={onComplete}
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

      <Box sx={{ overflow: "hidden", width: "100%", flex: 1, display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            display: "flex",
            width: `${SLIDES.length * 100}%`,
            transform: `translateX(-${(index * 100) / SLIDES.length}%)`,
            transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {SLIDES.map((slide) => (
            <Box
              key={slide.title}
              sx={{
                width: `${100 / SLIDES.length}%`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                px: 4,
                textAlign: "center",
              }}
            >
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
                {slide.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
                {slide.subtitle}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 3, pb: 6 }}>
        <IconButton onClick={back} disabled={index === 0} size="large">
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ display: "flex", gap: 1 }}>
          {SLIDES.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: i === index ? "primary.main" : "action.disabled",
                transition: "background-color 0.3s",
                cursor: "pointer",
              }}
              onClick={() => setIndex(i)}
            />
          ))}
        </Box>

        <IconButton onClick={next} size="large">
          <ArrowForwardIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
