import { useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  Tooltip,
  Divider,
  Box,
} from "@mui/material";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TerminalIcon from "@mui/icons-material/Terminal";
import { views } from "../views/registry";

const ICON_MAP: Record<string, React.ReactNode> = {
  Workspaces: <WorkspacesIcon />,
  Analytics: <AnalyticsIcon />,
  ChatBubbleOutline: <ChatBubbleOutlineIcon />,
  Settings: <SettingsIcon />,
};

function resolveIcon(name: string): React.ReactNode {
  return ICON_MAP[name] ?? <ExtensionIcon />;
}

const WIDTH = 72;

interface NavDrawerProps {
  onTerminalToggle?: () => void;
  terminalOpen?: boolean;
}

export function NavDrawer({ onTerminalToggle, terminalOpen }: NavDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: WIDTH,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
          overflowX: "hidden",
        },
      }}
    >
      <Box sx={{ height: 64 }} />
      <Divider />
      <Box sx={{ mt: 1, px: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <List disablePadding>
          {views.map((item) => (
            <Tooltip key={item.path} title={item.label} placement="right">
              <ListItemButton
                data-tour={`tour-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                selected={location.pathname.startsWith(item.path)}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 1,
                  minHeight: 44,
                  justifyContent: "center",
                  px: 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, justifyContent: "center" }}>
                  {resolveIcon(item.icon)}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ))}
        </List>

        <Box sx={{ mt: "auto", pb: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Tooltip title="Terminal" placement="right">
            <ListItemButton
              data-tour="tour-terminal"
              selected={!!terminalOpen}
              onClick={onTerminalToggle}
              sx={{
                borderRadius: 1,
                minHeight: 44,
                justifyContent: "center",
                px: 1.5,
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: "center" }}>
                <TerminalIcon />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  );
}
