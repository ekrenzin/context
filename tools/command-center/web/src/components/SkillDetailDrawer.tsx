import {
  Drawer,
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { SkillNode } from "../lib/api";
import { CATEGORY_COLORS } from "./cytoscapeStyles";

const CATEGORY_LABELS: Record<string, string> = {
  lifecycle: "Lifecycle",
  quality:   "Quality",
  memory:    "Memory",
  devtools:  "Dev Tools",
  platform:  "Platform",
  comms:     "Comms",
  unknown:   "Other",
};

interface Props {
  node: SkillNode | null;
  onClose: () => void;
}

export function SkillDetailDrawer({ node, onClose }: Props) {
  const color = node ? (CATEGORY_COLORS[node.category] ?? "#888") : "#888";

  return (
    <Drawer
      anchor="right"
      open={node !== null}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 400,
          p: 2.5,
          bgcolor: "background.paper",
          borderLeft: 1,
          top: 64,
          height: "calc(100% - 64px)",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        },
      }}
    >
      {node && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}88`,
                }}
              />
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ color, letterSpacing: "0.02em" }}
              >
                {node.id}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Chip
            size="small"
            label={CATEGORY_LABELS[node.category] ?? node.category}
            sx={{
              alignSelf: "flex-start",
              mb: 2,
              backgroundColor: `${color}22`,
              color,
              border: `1px solid ${color}55`,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />

          <Divider sx={{ mb: 2 }} />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Description
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.75, color: "text.primary" }}>
            {node.description}
          </Typography>

          {node.relatedSkills.length > 0 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                Related Skills ({node.relatedSkills.length})
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {node.relatedSkills.map((s) => (
                  <Chip
                    key={s}
                    size="small"
                    label={s}
                    variant="outlined"
                    sx={{ fontSize: "0.65rem", mb: 0.5 }}
                  />
                ))}
              </Stack>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
