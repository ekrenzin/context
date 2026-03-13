import { Box, Skeleton, Typography, Stack } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { useProject } from "../hooks/useProject";
import { FileBrowser } from "../components/FileBrowser";

export default function ProjectFiles() {
  const { project, loading } = useProject();

  if (loading || !project) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rounded" height={400} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <FolderOpenIcon fontSize="small" color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {project.name} -- Files
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {project.root_path}
        </Typography>
      </Stack>
      <FileBrowser
        rootPath={project.root_path}
        height="calc(100vh - 160px)"
      />
    </Box>
  );
}
