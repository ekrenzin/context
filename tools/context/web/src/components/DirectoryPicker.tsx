import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Stack,
  TextField,
  Breadcrumbs,
  Link,
  Box,
  Skeleton,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface BrowseResult {
  current: string;
  parent: string;
  entries: DirEntry[];
  exists: boolean;
}

async function browse(dirPath?: string): Promise<BrowseResult> {
  const qs = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
  const res = await fetch(`/api/fs/browse${qs}`);
  return res.json();
}

interface DirectoryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
}

export function DirectoryPicker({ open, onClose, onSelect, title }: DirectoryPickerProps) {
  const [current, setCurrent] = useState("");
  const [parent, setParent] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolder, setNewFolder] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback((dir?: string) => {
    setLoading(true);
    browse(dir)
      .then((r) => {
        setCurrent(r.current);
        setParent(r.parent);
        setEntries(r.entries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function handleSelect() {
    if (showNew && newFolder.trim()) {
      const fullPath = current.endsWith("/")
        ? `${current}${newFolder.trim()}`
        : `${current}/${newFolder.trim()}`;
      onSelect(fullPath);
    } else {
      onSelect(current);
    }
    onClose();
  }

  const breadcrumbs = current.split("/").filter(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title ?? "Choose Location"}</DialogTitle>
      <DialogContent>
        <Breadcrumbs sx={{ mb: 1.5, fontSize: "0.8rem" }}>
          <Link
            component="button"
            underline="hover"
            onClick={() => load("/")}
            sx={{ fontSize: "0.8rem" }}
          >
            /
          </Link>
          {breadcrumbs.map((seg, i) => {
            const fullPath = "/" + breadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === breadcrumbs.length - 1;
            return isLast ? (
              <Typography key={fullPath} sx={{ fontSize: "0.8rem" }} color="text.primary">
                {seg}
              </Typography>
            ) : (
              <Link
                key={fullPath}
                component="button"
                underline="hover"
                onClick={() => load(fullPath)}
                sx={{ fontSize: "0.8rem" }}
              >
                {seg}
              </Link>
            );
          })}
        </Breadcrumbs>

        <Box sx={{ maxHeight: 320, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={40} sx={{ m: 0.5 }} />
            ))
          ) : (
            <List dense disablePadding>
              {parent && parent !== current && (
                <ListItemButton onClick={() => load(parent)}>
                  <ListItemIcon sx={{ minWidth: 36 }}><ArrowUpwardIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary=".." />
                </ListItemButton>
              )}
              {entries.map((e) => (
                <ListItemButton key={e.path} onDoubleClick={() => load(e.path)}>
                  <ListItemIcon sx={{ minWidth: 36 }}><FolderIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary={e.name} />
                </ListItemButton>
              ))}
              {entries.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  Empty directory
                </Typography>
              )}
            </List>
          )}
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
          <Button
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => setShowNew((p) => !p)}
            variant={showNew ? "contained" : "outlined"}
          >
            New folder
          </Button>
          {showNew && (
            <TextField
              size="small"
              placeholder="Folder name"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              sx={{ flex: 1 }}
            />
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
          Selected: {showNew && newFolder ? `${current}/${newFolder}` : current}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSelect} disabled={!current}>
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
}
