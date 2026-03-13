import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Stack,
  CircularProgress,
} from "@mui/material";
import { api } from "../lib/api";
import { type WizardState, INITIAL_STATE } from "./wizard-config";
import { BasicsStep, ReposStepFull } from "./wizard-steps";
import { ToolsStep, GoalsStep, ReviewStep } from "./wizard-choices";

const STEPS = ["Basics", "Repositories", "Tools", "Goals", "Review"];

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [repoInput, setRepoInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const project = await api.createProject({
        name: state.name,
        description: state.description,
        rootPath: state.rootPath,
        projectType: state.projectType,
        goals: state.goals,
        repos: state.repos,
        config: { ides: state.ides },
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  const canNext = step === 0 ? state.name.trim() && state.rootPath.trim() : true;

  return (
    <Box sx={{ pt: 2, maxWidth: 700, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>New Project</Typography>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {step === 0 && <BasicsStep state={state} update={update} />}
      {step === 1 && (
        <ReposStepFull
          state={state}
          update={update}
          repoInput={repoInput}
          setRepoInput={setRepoInput}
        />
      )}
      {step === 2 && <ToolsStep state={state} update={update} />}
      {step === 3 && <GoalsStep state={state} update={update} />}
      {step === 4 && <ReviewStep state={state} error={error} />}

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
        <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="contained" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !state.name.trim() || !state.rootPath.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : undefined}
          >
            {creating ? "Creating..." : "Create Project"}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
