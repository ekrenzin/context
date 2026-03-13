import { useState } from "react";
import {
  TextField,
  Stack,
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { DirectoryPicker } from "../components/DirectoryPicker";
import {
  type WizardState,
  PROJECT_TYPES,
} from "./wizard-config";

declare global {
  interface Window {
    ctx?: { pickDirectory?: () => Promise<string | null> };
  }
}

function isElectron(): boolean {
  return typeof window.ctx?.pickDirectory === "function";
}

interface StepProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function BasicsStep({ state, update }: StepProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleBrowse() {
    if (isElectron()) {
      const dir = await window.ctx!.pickDirectory!();
      if (dir) update({ rootPath: dir });
    } else {
      setPickerOpen(true);
    }
  }

  return (
    <Stack spacing={2.5}>
      <TextField
        label="Project name"
        value={state.name}
        onChange={(e) => update({ name: e.target.value })}
        fullWidth
        required
      />
      <TextField
        label="Description"
        value={state.description}
        onChange={(e) => update({ description: e.target.value })}
        fullWidth
        multiline
        rows={2}
      />
      <TextField
        label="Workspace location"
        helperText="Where the project workspace will be created"
        value={state.rootPath}
        onChange={(e) => update({ rootPath: e.target.value })}
        fullWidth
        required
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleBrowse} edge="end" aria-label="browse">
                  <FolderOpenIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <DirectoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(p) => update({ rootPath: p })}
        title="Choose workspace location"
      />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>What kind of project?</Typography>
        <Stack direction="row" spacing={1}>
          {PROJECT_TYPES.map((t) => (
            <Chip
              key={t}
              label={t}
              onClick={() => update({ projectType: t })}
              color={state.projectType === t ? "primary" : "default"}
              variant={state.projectType === t ? "filled" : "outlined"}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

export function ReposStepFull({
  state,
  update,
  repoInput,
  setRepoInput,
}: StepProps & { repoInput: string; setRepoInput: (v: string) => void }) {
  function addRepo() {
    if (!repoInput.trim()) return;
    const name = repoInput.split("/").pop()?.replace(".git", "") ?? repoInput;
    update({ repos: [...state.repos, { name, url: repoInput.trim() }] });
    setRepoInput("");
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Connect existing repositories or start fresh. You can add more later.
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="GitHub URL or local path"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          fullWidth
          size="small"
          onKeyDown={(e) => e.key === "Enter" && addRepo()}
        />
        <Button variant="outlined" onClick={addRepo}>Add</Button>
      </Stack>
      {state.repos.map((r, i) => (
        <Card key={i} variant="outlined">
          <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
              <Button
                size="small"
                color="error"
                onClick={() => update({ repos: state.repos.filter((_, j) => j !== i) })}
              >
                Remove
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">{r.url}</Typography>
          </CardContent>
        </Card>
      ))}
      {state.repos.length === 0 && (
        <Alert severity="info">No repositories added. Start fresh or add later.</Alert>
      )}
    </Stack>
  );
}

