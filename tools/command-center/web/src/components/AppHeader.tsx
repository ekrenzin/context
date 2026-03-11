import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { IdentitySnapshot } from "../lib/api";
import { useUpdateStatus } from "../hooks/useUpdateStatus";
import { CommitDropdown } from "./CommitDropdown";
import { StatusDropdown } from "./StatusDropdown";

interface AppHeaderProps {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  socketConnected: boolean;
  identities: IdentitySnapshot;
}

export function AppHeader({
  onToggleDrawer,
  socketConnected,
  identities,
}: AppHeaderProps) {
  const update = useUpdateStatus();

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider", zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.25 }}>
        <IconButton onClick={onToggleDrawer} edge="start" aria-label="toggle navigation">
          <MenuIcon />
        </IconButton>

        <Avatar src="/logo.png" alt="Context logo" variant="rounded" sx={{ width: 30, height: 30 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mr: 1 }}>
          Command Center
        </Typography>

        <CommitDropdown update={update} />

        <Box sx={{ flex: 1 }} />

        <StatusDropdown socketConnected={socketConnected} identities={identities} />
      </Toolbar>
    </AppBar>
  );
}
