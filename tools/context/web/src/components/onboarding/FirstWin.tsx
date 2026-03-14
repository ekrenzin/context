import { Box, Typography, Card, Chip, Button, Stack } from "@mui/material";

interface ProposalInfo {
  slug: string;
  title: string;
  taskCount: number;
  tasksByStatus: Record<string, number>;
}

interface Props {
  proposal: ProposalInfo;
  onViewProposal: () => void;
  onFinish: () => void;
}

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

export function FirstWin({ proposal, onViewProposal, onFinish }: Props) {
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
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Your first proposal is ready.
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          You just watched an AI agent turn a problem into a structured plan.
          Now you can review it and kick off the build whenever you're ready.
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
            <Typography variant="h6" fontWeight={600}>{proposal.title}</Typography>
            <Chip label="Draft" color="info" size="small" />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`${proposal.taskCount} task${proposal.taskCount !== 1 ? "s" : ""}`}
              size="small"
              variant="outlined"
            />
            {Object.entries(proposal.tasksByStatus).map(([status, count]) => (
              <Chip
                key={status}
                label={`${count} ${status}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Card>

        <Stack spacing={1.5} sx={{ animation: "slide-up 0.7s ease-out" }}>
          <Button variant="contained" fullWidth onClick={onViewProposal} disableElevation size="large">
            View Proposal
          </Button>
          <Button variant="outlined" fullWidth onClick={onFinish} size="large">
            Go to Dashboard
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
