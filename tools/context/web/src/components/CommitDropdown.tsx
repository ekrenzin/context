import { useState, useRef } from "react";
import {
  Chip,
  Popover,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { UpdateStatus, CommitInfo } from "../lib/api";

interface Props {
  update: UpdateStatus;
}

function stateTooltip(update: UpdateStatus): string {
  if (update.stashConflict) {
    return `pulled, but local changes conflicted (saved in git stash)`;
  }
  if (update.state === "current") return "up to date";
  if (update.state === "behind") return `${update.behind} commit(s) behind`;
  if (update.state === "ahead") return `${update.ahead} commit(s) ahead`;
  if (update.state === "diverged") {
    return `diverged (${update.ahead} ahead, ${update.behind} behind)`;
  }
  if (update.state === "error") return `Error: ${update.error ?? "unknown"}`;
  return "Checking...";
}

function chipColor(
  update: UpdateStatus,
): "success" | "warning" | "error" | "default" {
  if (update.stashConflict) return "warning";
  if (update.state === "current") return "success";
  if (update.state === "behind" || update.state === "diverged") return "warning";
  if (update.state === "error") return "error";
  return "default";
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export function CommitDropdown({ update }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const shaLabel = update.sha ? update.sha.slice(0, 7) : "...";
  const commitMsg = update.commitMessage ?? "";
  const truncatedMsg =
    commitMsg.length > 40 ? commitMsg.slice(0, 37) + "..." : commitMsg;
  const history: CommitInfo[] = update.history ?? [];

  return (
    <>
      <Box
        ref={anchorRef}
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          cursor: "pointer",
          borderRadius: 1,
          px: 0.5,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={shaLabel}
          color={chipColor(update)}
          sx={{ fontFamily: "monospace", fontSize: 11, height: 22 }}
        />
        {truncatedMsg && (
          <Typography
            variant="caption"
            noWrap
            sx={{
              maxWidth: 200,
              color: "text.secondary",
              fontSize: 11,
            }}
          >
            {truncatedMsg}
          </Typography>
        )}
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            color: "text.secondary",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </Box>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { width: 420, maxHeight: 480, mt: 0.5 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {update.branch}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stateTooltip(update)}
          </Typography>
        </Box>

        {commitMsg && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {commitMsg}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              {shaLabel}
            </Typography>
          </Box>
        )}

        {history.length > 1 && (
          <>
            <Divider />
            <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ fontSize: 10 }}
              >
                Recent commits
              </Typography>
            </Box>
            <List dense disablePadding sx={{ pb: 1 }}>
              {history.slice(1).map((c) => (
                <ListItem key={c.sha} sx={{ px: 2, py: 0.25 }}>
                  <ListItemText
                    primary={c.message}
                    secondary={
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          gap: 1,
                          alignItems: "center",
                        }}
                      >
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ fontFamily: "monospace", fontSize: 11 }}
                        >
                          {c.sha}
                        </Typography>
                        <Typography component="span" variant="caption">
                          {c.author}
                        </Typography>
                        {c.date && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.disabled"
                          >
                            {formatRelative(c.date)}
                          </Typography>
                        )}
                      </Box>
                    }
                    primaryTypographyProps={{
                      variant: "body2",
                      noWrap: true,
                      sx: { fontSize: 13 },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Popover>
    </>
  );
}
