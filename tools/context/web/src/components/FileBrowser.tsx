import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  api,
  type ProjectFileEntry,
  type ProjectBrowseResult,
  type FileReadResult,
} from "../lib/api";

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx", ".js": "javascript",
  ".jsx": "jsx", ".json": "json", ".md": "markdown",
  ".py": "python", ".rs": "rust", ".go": "go",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
  ".css": "css", ".html": "html", ".sh": "bash",
  ".sql": "sql", ".graphql": "graphql",
};

function langFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  return EXT_LANG[name.slice(dot)] ?? "plaintext";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTree({
  browse,
  onNavigate,
  onSelect,
  selected,
}: {
  browse: ProjectBrowseResult;
  onNavigate: (path: string) => void;
  onSelect: (entry: ProjectFileEntry) => void;
  selected: string | null;
}) {
  return (
    <List dense disablePadding>
      {browse.parent && (
        <ListItemButton onClick={() => onNavigate(browse.parent!)}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ArrowBackIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary=".."
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
      )}
      {browse.entries.map((entry) => (
        <ListItemButton
          key={entry.path}
          selected={selected === entry.path}
          onClick={() =>
            entry.isDir ? onNavigate(entry.path) : onSelect(entry)
          }
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {entry.isDir ? (
              <FolderIcon fontSize="small" color="primary" />
            ) : (
              <InsertDriveFileIcon fontSize="small" color="action" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={entry.name}
            primaryTypographyProps={{ variant: "body2", noWrap: true }}
          />
          {!entry.isDir && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1, flexShrink: 0 }}
            >
              {formatSize(entry.size)}
            </Typography>
          )}
        </ListItemButton>
      ))}
      {browse.entries.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Empty directory
        </Typography>
      )}
    </List>
  );
}

function FileViewer({ file }: { file: FileReadResult }) {
  if (file.binary) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <InsertDriveFileIcon
          sx={{ fontSize: 48, color: "text.secondary", mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          Binary file ({formatSize(file.size)})
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}
        alignItems="center"
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {file.name}
        </Typography>
        <Chip
          label={langFromName(file.name)}
          size="small"
          variant="outlined"
        />
        <Typography variant="caption" color="text.secondary">
          {formatSize(file.size)}
        </Typography>
        {file.truncated && (
          <Chip
            label="truncated"
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          overflow: "auto",
          fontSize: "0.8rem",
          lineHeight: 1.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          bgcolor: "action.hover",
          whiteSpace: "pre",
          tabSize: 2,
        }}
      >
        {file.content}
      </Box>
    </Box>
  );
}

function buildCrumbs(
  root: string,
  current: string,
): Array<{ label: string; path: string }> {
  const rootName = root.split("/").pop() ?? root;
  if (current === root) {
    return [{ label: rootName, path: root }];
  }
  const rel = current.slice(root.length).replace(/^\//, "");
  const parts = rel.split("/");
  const crumbs = [{ label: rootName, path: root }];
  let acc = root;
  for (const part of parts) {
    acc = acc + "/" + part;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

interface FileBrowserProps {
  rootPath: string;
  /** CSS height for the browser panel. Defaults to 480px. */
  height?: string | number;
}

export function FileBrowser({ rootPath, height = 480 }: FileBrowserProps) {
  const [browse, setBrowse] = useState<ProjectBrowseResult | null>(null);
  const [file, setFile] = useState<FileReadResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const navigateTo = useCallback(
    (dirPath: string) => {
      setLoading(true);
      setFile(null);
      setSelected(null);
      api
        .projectBrowse(rootPath, dirPath)
        .then(setBrowse)
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [rootPath],
  );

  const selectFile = useCallback(
    (entry: ProjectFileEntry) => {
      setSelected(entry.path);
      api
        .readFile(entry.path, rootPath)
        .then(setFile)
        .catch(() => setFile(null));
    },
    [rootPath],
  );

  useEffect(() => {
    navigateTo(rootPath);
  }, [rootPath, navigateTo]);

  const crumbs = browse ? buildCrumbs(browse.root, browse.current) : [];

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Breadcrumbs sx={{ flex: 1 }}>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return isLast ? (
              <Typography
                key={c.path}
                variant="body2"
                color="text.primary"
              >
                {c.label}
              </Typography>
            ) : (
              <Link
                key={c.path}
                component="button"
                variant="body2"
                underline="hover"
                onClick={() => navigateTo(c.path)}
              >
                {c.label}
              </Link>
            );
          })}
        </Breadcrumbs>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => browse && navigateTo(browse.current)}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ display: "flex", gap: 1.5, height }}>
        <Paper
          variant="outlined"
          sx={{ width: 280, minWidth: 200, overflow: "auto", flexShrink: 0 }}
        >
          {loading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="text" height={32} />
              ))}
            </Box>
          ) : browse ? (
            <FileTree
              browse={browse}
              onNavigate={navigateTo}
              onSelect={selectFile}
              selected={selected}
            />
          ) : null}
        </Paper>

        <Paper
          variant="outlined"
          sx={{ flex: 1, overflow: "auto", minWidth: 0 }}
        >
          {file ? (
            <FileViewer file={file} />
          ) : (
            <Box
              sx={{
                p: 3,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Select a file to view its contents
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
