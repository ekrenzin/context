import { useState } from "react";
import { Box, Typography, Card, CardActionArea, Button, Stack } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import CodeIcon from "@mui/icons-material/Code";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

type Persona = "non-technical" | "power-user";

interface Props {
  onSelect: (persona: Persona) => void;
  onBack: () => void;
}

const OPTIONS: Array<{ persona: Persona; icon: typeof GroupsIcon; title: string; subtitle: string }> = [
  {
    persona: "non-technical",
    icon: GroupsIcon,
    title: "I manage projects and teams",
    subtitle: "The system learns your project patterns and builds tools for you",
  },
  {
    persona: "power-user",
    icon: CodeIcon,
    title: "I build software",
    subtitle: "Isolated intelligence per project. Rules, skills, and memory that evolve from your sessions.",
  },
];

export function PersonaStep({ onSelect, onBack }: Props) {
  const [selected, setSelected] = useState<Persona | null>(null);

  function handleClick(persona: Persona) {
    setSelected(persona);
    setTimeout(() => onSelect(persona), 300);
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 6, px: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, textTransform: "none" }}>
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        How do you work?
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        This shapes what the system builds for you.
      </Typography>

      <Stack spacing={2}>
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = selected === opt.persona;
          return (
            <Card
              key={opt.persona}
              variant="outlined"
              sx={{
                borderColor: active ? "primary.main" : "divider",
                borderWidth: active ? 2 : 1,
                transform: active ? "scale(1.02)" : "scale(1)",
                transition: "all 0.2s ease",
              }}
            >
              <CardActionArea onClick={() => handleClick(opt.persona)} sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Icon sx={{ fontSize: 36, color: active ? "primary.main" : "text.secondary", mt: 0.5 }} />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>{opt.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {opt.subtitle}
                    </Typography>
                  </Box>
                </Box>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
