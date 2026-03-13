import {
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CATEGORY_COLORS } from "../cytoscapeStyles";

interface Props {
  id: string;
  description: string;
  category: string;
  relatedSkills: string[];
  onClose: () => void;
  onNavigate: (skillId: string) => void;
}

export default function SkillDetail({
  id,
  description,
  category,
  relatedSkills,
  onClose,
  onNavigate,
}: Props) {
  return (
    <Box
      sx={{
        width: 280,
        p: 2,
        borderLeft: 1,
        borderColor: "divider",
        height: "100%",
        overflow: "auto",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1,
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: 16 }}>
          {id}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Chip
        label={category}
        size="small"
        sx={{
          mb: 1.5,
          bgcolor: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.unknown,
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.7rem",
        }}
      />

      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}

      {relatedSkills.length > 0 && (
        <>
          <Divider sx={{ mb: 1 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
          >
            Related Skills
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {relatedSkills.map((s) => (
              <Chip
                key={s}
                label={s}
                size="small"
                variant="outlined"
                onClick={() => onNavigate(s)}
                sx={{ cursor: "pointer", fontSize: "0.65rem" }}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
