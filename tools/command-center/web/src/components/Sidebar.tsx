import { useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import BarChartIcon from "@mui/icons-material/BarChart";
import BuildIcon from "@mui/icons-material/Build";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useColorMode } from "../hooks/useColorMode";
import { useMqttConnected } from "../hooks/useMqtt";

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { path: "/sessions", label: "Sessions", icon: <ChatIcon /> },
  { path: "/analytics", label: "Analytics", icon: <BarChartIcon /> },
  { path: "/operations", label: "Operations", icon: <BuildIcon /> },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggle } = useColorMode();
  const connected = useMqttConnected();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
        },
      }}
    >
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Avatar
          src="/logo.png"
          alt="Context logo"
          variant="rounded"
          sx={{ width: 34, height: 34, borderRadius: 1 }}
        />
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, letterSpacing: 0.2 }}>
          Command Center
        </Typography>
        <Tooltip title={connected ? "Connected" : "Disconnected"}>
          <FiberManualRecordIcon
            sx={{ fontSize: 10, color: connected ? "success.main" : "error.main" }}
          />
        </Tooltip>
        <Tooltip title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}>
          <IconButton size="small" onClick={toggle}>
            {mode === "dark" ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1 }}>
        <Chip
          label="Command Center"
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: "0.7rem" }}
        />
      </Box>

      <List sx={{ flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => navigate(item.path)}
            sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Context
        </Typography>
      </Box>
    </Drawer>
  );
}
