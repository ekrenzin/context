import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  Grid,
  Chip,
  Skeleton,
  Alert,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Snackbar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderIcon from "@mui/icons-material/Folder";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import EditNoteIcon from "@mui/icons-material/EditNote";
import AirIcon from "@mui/icons-material/Air";
import { api, type ProjectRecord } from "../lib/api";
import { DirectoryPicker } from "../components/DirectoryPicker";

const IDE_ICONS: Record<string, React.ReactElement> = {
  "claude-code": <SmartToyIcon fontSize="small" />,
  codex: <CodeIcon fontSize="small" />,
  cursor: <EditNoteIcon fontSize="small" />,
  windsurf: <AirIcon fontSize="small" />,
};

interface ProjectCardProps {
  project: ProjectRecord;
  ides: Array<{ name: string }>;
  onDelete: (id: string) => void;
  onLaunch: (projectId: string, ide: string) => void;
}

function ProjectCard({ project, ides, onDelete, onLaunch }: ProjectCardProps) {
  const navigate = useNavigate();
  const config = JSON.parse(project.config || "{}");

  return (
    <Card variant="outlined">
      <CardActionArea onClick={() => navigate(`/projects/${project.id}`)}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FolderIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              {project.name}
            </Typography>
          </Stack>
          {project.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {project.description}
            </Typography>
          )}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Chip
              label={project.status}
              size="small"
              color={project.status === "active" ? "success" : "default"}
              variant="outlined"
            />
            {config.projectType && (
              <Chip label={config.projectType} size="small" variant="outlined" />
            )}
            <Chip
              label={new Date(project.updated_at).toLocaleDateString()}
              size="small"
              variant="outlined"
            />
          </Stack>
        </CardContent>
      </CardActionArea>
      <CardActions sx={{ justifyContent: "space-between", pt: 0 }}>
        <Stack direction="row" spacing={0}>
          {ides.map((ide) => (
            <Tooltip key={ide.name} title={`Open in ${ide.name}`}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch(project.id, ide.name);
                }}
              >
                {IDE_ICONS[ide.name] ?? <CodeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          ))}
        </Stack>
        <Tooltip title="Delete project">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${project.name}"?`)) {
                onDelete(project.id);
              }
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [ides, setIdes] = useState<Array<{ name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.listIdes().then(setIdes).catch(() => {});
  }, []);

  async function handleLaunch(projectId: string, ide: string) {
    try {
      const result = await api.launchIde(projectId, ide);
      if (result.method === "session" && result.sessionId) {
        navigate(`/terminal?session=${result.sessionId}&label=${encodeURIComponent(result.label)}`);
      } else {
        setToast(`Opened ${result.label}`);
      }
    } catch {
      setToast(`Failed to launch ${ide}`);
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    api.listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleImport(rootPath: string) {
    setImporting(true);
    try {
      const project = await api.importProject(rootPath);
      navigate(`/projects/${project.id}`);
    } catch {
      load();
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      load();
    }
  }

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Projects</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => setPickerOpen(true)}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import Folder"}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/projects/new")}
          >
            New Project
          </Button>
        </Stack>
      </Stack>

      <DirectoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleImport}
        title="Import Project Folder"
      />

      {projects.length === 0 ? (
        <Alert severity="info">
          No projects yet. Create one to start building your intelligence layer.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {projects.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <ProjectCard project={p} ides={ides} onDelete={handleDelete} onLaunch={handleLaunch} />
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
