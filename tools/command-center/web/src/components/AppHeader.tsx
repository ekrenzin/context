import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Tooltip,
} from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useUpdateStatus } from "../hooks/useUpdateStatus";
import { useBranding } from "../lib/branding";
import { CommitDropdown } from "./CommitDropdown";
import { StatusDropdown } from "./StatusDropdown";

interface AppHeaderProps {
  onResetOnboarding?: () => void;
}

export function AppHeader({
  onResetOnboarding,
}: AppHeaderProps) {
  const update = useUpdateStatus();
  const branding = useBranding();

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider", zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.25 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 30,
            height: 30,
            background: branding.accentGradient,
          }}
        >
          <LayersIcon sx={{ fontSize: 18, color: "#fff" }} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mr: 1 }}>
          {branding.subtitle}
        </Typography>

        <CommitDropdown update={update} />

        <Box sx={{ flex: 1 }} />

        {onResetOnboarding && (
          <Tooltip title="Re-run onboarding">
            <IconButton onClick={onResetOnboarding} size="small" sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <StatusDropdown />
      </Toolbar>
    </AppBar>
  );
}
