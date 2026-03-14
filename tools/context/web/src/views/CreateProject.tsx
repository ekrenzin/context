import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { api } from "../lib/api";
import { DirectoryPicker } from "../components/DirectoryPicker";
import { PageLayout } from "../components/PageLayout";

declare global {
  interface Window {
    ctx?: { pickDirectory?: () => Promise<string | null> };
  }
}

const PROJECT_TYPES = ["software", "operations", "research", "mixed"];

function isElectron(): boolean {
  return typeof window.ctx?.pickDirectory === "function";
}

export default function CreateProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [projectType, setProjectType] = useState("software");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleBrowse() {
    if (isElectron()) {
      const dir = await window.ctx!.pickDirectory!();
      if (dir) setRootPath(dir);
    } else {
      setPickerOpen(true);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const project = await api.createProject({
        name,
        description,
        rootPath,
        projectType,
        goals: [],
        repos: [],
        config: { ides: ["cursor"] },
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  const valid = name.trim() && rootPath.trim();

  return (
    <PageLayout title="New Project">
      <Box sx={{ maxWidth: 560 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Root path"
            helperText="Directory where the workspace will be created"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
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
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Project type
            </Typography>
            <Stack direction="row" spacing={1}>
              {PROJECT_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  onClick={() => setProjectType(t)}
                  color={projectType === t ? "primary" : "default"}
                  variant={projectType === t ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={creating || !valid}
              startIcon={creating ? <CircularProgress size={16} /> : undefined}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </Stack>
        </Stack>

        <DirectoryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(p) => setRootPath(p)}
          title="Choose workspace location"
        />
      </Box>
    </PageLayout>
  );
}
