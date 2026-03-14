import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  Chip,
  Skeleton,
  Alert,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Snackbar,
  LinearProgress,
  useTheme,
  alpha,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CodeIcon from "@mui/icons-material/Code";
import EditNoteIcon from "@mui/icons-material/EditNote";
import AirIcon from "@mui/icons-material/Air";
import { api, type ProjectRecord } from "../lib/api";
import { CardGrid } from "../components/CardGrid";
import { DirectoryPicker } from "../components/DirectoryPicker";
import { PageLayout } from "../components/PageLayout";

const IDE_ICONS: Record<string, React.ReactElement> = {
  "claude-code": <SmartToyIcon fontSize="small" />,
  codex: <CodeIcon fontSize="small" />,
  cursor: <EditNoteIcon fontSize="small" />,
  windsurf: <AirIcon fontSize="small" />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface ProjectCardProps {
  project: ProjectRecord;
  ides: Array<{ name: string }>;
  onDelete: (id: string) => void;
  onLaunch: (projectId: string, ide: string) => void;
}

function ProjectCard({ project, ides, onDelete, onLaunch }: ProjectCardProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const config = JSON.parse(project.config || "{}");

  // Derive a simple "maturity" signal from config
  const goals: string[] = config.goals ?? [];
  const maturity = goals.length > 3 ? "growing" : goals.length > 0 ? "learning" : "new";
  const maturityColor =
    maturity === "growing" ? "success" : maturity === "learning" ? "info" : "default";
  const maturityProgress = maturity === "growing" ? 70 : maturity === "learning" ? 35 : 5;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: alpha(theme.palette.primary.main, 0.12),
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/projects/${project.id}`)}
        sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <PsychologyIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
              {project.name}
            </Typography>
          </Stack>

          {project.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {project.description}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap>
            {project.root_path}
          </Typography>

          {/* Maturity indicator */}
          <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Chip
                label={maturity}
                size="small"
                color={maturityColor}
                variant="outlined"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
              <Typography variant="caption" color="text.secondary">
                {timeAgo(project.updated_at)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={maturityProgress}
              sx={{
                height: 3,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
      <CardActions sx={{ justifyContent: "space-between", pt: 0, px: 1.5, pb: 1 }}>
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

export default function Projects({ embedded }: { embedded?: boolean }) {
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

  const actionButtons = (
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
  );

  const content = (
    <>
      <DirectoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleImport}
        title="Import Project Folder"
      />

      {loading ? (
        <>
          <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
          <CardGrid>
            {[1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton variant="rounded" height={160} />
              </Box>
            ))}
          </CardGrid>
        </>
      ) : projects.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <PsychologyIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No projects yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create a project to start building an intelligence layer around your codebase.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => setPickerOpen(true)}
            >
              Import existing folder
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/projects/new")}
            >
              New Project
            </Button>
          </Stack>
        </Box>
      ) : (
        <CardGrid>
          {projects.map((p) => (
            <Box key={p.id}>
              <ProjectCard project={p} ides={ides} onDelete={handleDelete} onLaunch={handleLaunch} />
            </Box>
          ))}
        </CardGrid>
      )}

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast("")} message={toast} />
    </>
  );

  if (embedded) {
    return (
      <Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>{actionButtons}</Box>
        {content}
      </Box>
    );
  }

  return (
    <PageLayout title="Projects" actions={actionButtons}>
      {content}
    </PageLayout>
  );
}
