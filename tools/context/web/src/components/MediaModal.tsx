import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { PreviewEntry } from "../hooks/usePreviewEntries";

interface Props {
  entries: PreviewEntry[];
  open: boolean;
  onClose: () => void;
}

function isImageType(type: string): boolean {
  return type === "image" || type === "svg";
}

function isEmbeddable(type: string): boolean {
  return type === "pdf" || type === "html";
}

function MediaContent({ entry }: { entry: PreviewEntry }) {
  if (isImageType(entry.type)) {
    return (
      <Box
        component="img"
        src={entry.url}
        alt={entry.title}
        sx={{
          maxWidth: "100%",
          maxHeight: "70vh",
          objectFit: "contain",
          display: "block",
          mx: "auto",
          borderRadius: 1,
        }}
      />
    );
  }

  if (isEmbeddable(entry.type)) {
    return (
      <Box
        component="iframe"
        src={entry.url}
        title={entry.title}
        sx={{ width: "100%", height: "70vh", border: "none", borderRadius: 1 }}
      />
    );
  }

  return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="body1" gutterBottom>
        {entry.title} ({entry.type})
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <a href={entry.url} target="_blank" rel="noopener noreferrer">
          Open in new tab
        </a>
      </Typography>
    </Box>
  );
}

export function MediaModal({ entries, open, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset to latest entry when opening
  useEffect(() => {
    if (open && entries.length > 0) {
      setActiveIndex(entries.length - 1);
    }
  }, [open, entries.length]);

  const active = entries[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < entries.length - 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { maxHeight: "90vh" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 6 }}>
        <Typography variant="h6" component="span" noWrap sx={{ flex: 1 }}>
          {active?.title}
        </Typography>
        {active && <Chip label={active.type} size="small" variant="outlined" />}
        <Chip
          label={`${activeIndex + 1} / ${entries.length}`}
          size="small"
          variant="outlined"
          color="primary"
        />
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Box sx={{ position: "relative" }}>
          {hasPrev && (
            <IconButton
              onClick={() => setActiveIndex((i) => i - 1)}
              sx={{
                position: "absolute", left: 0, top: "50%",
                transform: "translateY(-50%)", zIndex: 1,
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <NavigateBeforeIcon />
            </IconButton>
          )}

          {active && <MediaContent entry={active} />}

          {hasNext && (
            <IconButton
              onClick={() => setActiveIndex((i) => i + 1)}
              sx={{
                position: "absolute", right: 0, top: "50%",
                transform: "translateY(-50%)", zIndex: 1,
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <NavigateNextIcon />
            </IconButton>
          )}
        </Box>

        {entries.length > 1 && (
          <ThumbnailStrip
            entries={entries}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ThumbnailStrip({
  entries, activeIndex, onSelect,
}: {
  entries: PreviewEntry[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, mt: 2, overflowX: "auto", pb: 1 }}>
      {entries.map((entry, i) => (
        <Box
          key={entry.id}
          onClick={() => onSelect(i)}
          sx={{
            cursor: "pointer",
            border: 2,
            borderColor: i === activeIndex ? "primary.main" : "transparent",
            borderRadius: 1,
            overflow: "hidden",
            minWidth: 80,
            height: 56,
            flexShrink: 0,
            opacity: i === activeIndex ? 1 : 0.6,
            "&:hover": { opacity: 1 },
          }}
        >
          {isImageType(entry.type) ? (
            <img
              src={entry.url}
              alt={entry.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box
              sx={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="caption" noWrap sx={{ px: 0.5 }}>
                {entry.type}
              </Typography>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
