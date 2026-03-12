import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { type WizardState, IDE_OPTIONS, GOAL_OPTIONS } from "./wizard-config";

interface StepProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function ToolsStep({ state, update }: StepProps) {
  function toggle(ide: string) {
    const next = state.ides.includes(ide)
      ? state.ides.filter((i) => i !== ide)
      : [...state.ides, ide];
    update({ ides: next });
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Which tools does your team use? Intelligence syncs to each.
      </Typography>
      <FormGroup>
        {IDE_OPTIONS.map((o) => (
          <FormControlLabel
            key={o.value}
            control={<Checkbox checked={state.ides.includes(o.value)} onChange={() => toggle(o.value)} />}
            label={o.label}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

export function GoalsStep({ state, update }: StepProps) {
  function toggle(goal: string) {
    const next = state.goals.includes(goal)
      ? state.goals.filter((g) => g !== goal)
      : [...state.goals, goal];
    update({ goals: next });
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What should the system learn about and track?
      </Typography>
      <FormGroup>
        {GOAL_OPTIONS.map((g) => (
          <FormControlLabel
            key={g}
            control={<Checkbox checked={state.goals.includes(g)} onChange={() => toggle(g)} />}
            label={g}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

export function ReviewStep({ state, error }: { state: WizardState; error: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Review</Typography>
        <Stack spacing={1}>
          <Typography variant="body2"><strong>Name:</strong> {state.name}</Typography>
          <Typography variant="body2"><strong>Type:</strong> {state.projectType}</Typography>
          <Typography variant="body2"><strong>Location:</strong> {state.rootPath}</Typography>
          {state.description && (
            <Typography variant="body2"><strong>Description:</strong> {state.description}</Typography>
          )}
          <Typography variant="body2">
            <strong>Repos:</strong> {state.repos.length === 0 ? "None" : state.repos.map((r) => r.name).join(", ")}
          </Typography>
          <Typography variant="body2"><strong>Tools:</strong> {state.ides.join(", ")}</Typography>
          <Typography variant="body2">
            <strong>Goals:</strong> {state.goals.length === 0 ? "Default" : state.goals.join(", ")}
          </Typography>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
}
