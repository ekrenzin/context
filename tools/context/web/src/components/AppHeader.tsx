import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LayersIcon from "@mui/icons-material/Layers";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useUpdateStatus } from "../hooks/useUpdateStatus";
import { useColorMode } from "../hooks/useColorMode";
import { useBranding, resolveAccent } from "../lib/branding";
import { useNavHistory } from "../hooks/useNavHistory";
import { CommitDropdown } from "./CommitDropdown";
import { StatusDropdown } from "./StatusDropdown";

interface AppHeaderProps {
  onResetOnboarding?: () => void;
}

export function AppHeader({
  onResetOnboarding,
}: AppHeaderProps) {
  const update = useUpdateStatus();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const branding = useBranding();
  const { canGoBack, goBack } = useNavHistory();

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
            background: resolveAccent(branding, mode),
          }}
        >
          <LayersIcon sx={{ fontSize: 18, color: "common.white" }} />
        </Avatar>
        {canGoBack && (
          <Tooltip title="Go back">
            <IconButton onClick={goBack} size="small" sx={{ mr: 0.5 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mr: 1 }}>
          {branding.subtitle}
        </Typography>

        <CommitDropdown update={update} />

        <Box sx={{ flex: 1 }} />

        <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton onClick={toggleColorMode} size="small">
            {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

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
