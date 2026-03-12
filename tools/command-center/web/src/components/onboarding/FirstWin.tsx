import { Box, Typography, Card, Chip, Button, Stack } from "@mui/material";

interface SolutionInfo {
  name: string;
  problem: string;
  components: Array<{ type: string }>;
}

interface Props {
  solution: SolutionInfo;
  insight: string;
  onExplore: () => void;
  onSolveAnother: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  service: "Backend",
  view: "Dashboard",
  rule: "AI Rules",
  skill: "Workflow",
  memory: "Knowledge",
};

const CONFETTI_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

const confettiKeyframes = `
@keyframes confetti-rise {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-120px) scale(0.4); }
}
@keyframes slide-up {
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

export function FirstWin({ solution, insight, onExplore, onSolveAnother }: Props) {
  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 6, px: 3, position: "relative", overflow: "hidden" }}>
      <style>{confettiKeyframes}</style>

      {CONFETTI_COLORS.map((color, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: color,
            top: "30%",
            left: `${15 + i * 14}%`,
            animation: `confetti-rise ${1.2 + i * 0.15}s ease-out forwards`,
            animationDelay: `${i * 0.1}s`,
            pointerEvents: "none",
          }}
        />
      ))}

      <Box sx={{ animation: "slide-up 0.5s ease-out" }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
          Problem solved.
        </Typography>

        <Card
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            animation: "slide-up 0.6s ease-out",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={600}>{solution.name}</Typography>
            <Chip label="Active" color="success" size="small" />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {solution.problem}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {solution.components.map((c, i) => (
              <Chip
                key={i}
                label={TYPE_LABELS[c.type] ?? c.type}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Card>

        {insight && (
          <Typography
            variant="body1"
            sx={{
              fontStyle: "italic",
              color: "text.secondary",
              mb: 4,
              animation: "slide-up 0.7s ease-out",
            }}
          >
            {insight}
          </Typography>
        )}

        <Stack spacing={1.5}>
          <Button variant="contained" fullWidth onClick={onExplore} disableElevation size="large">
            Explore Your Solution
          </Button>
          <Button variant="outlined" fullWidth onClick={onSolveAnother} size="large">
            Solve Another Problem
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
