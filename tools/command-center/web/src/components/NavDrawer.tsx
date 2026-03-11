import { useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
  Divider,
  Box,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import BuildIcon from "@mui/icons-material/Build";
import ChatIcon from "@mui/icons-material/Chat";
import BarChartIcon from "@mui/icons-material/BarChart";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HubIcon from "@mui/icons-material/Hub";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import StorageIcon from "@mui/icons-material/Storage";
import SubjectIcon from "@mui/icons-material/Subject";


interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { path: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    ],
  },
  {
    label: "Development",
    items: [
      { path: "/operations", label: "Operations", icon: <BuildIcon /> },

      { path: "/logs", label: "Logs", icon: <SubjectIcon /> },
      { path: "/dev-db", label: "Dev DB", icon: <StorageIcon /> },
    ],
  },
  {
    label: "Insights",
    items: [
      { path: "/sessions", label: "Sessions", icon: <ChatIcon /> },
      { path: "/analytics", label: "Analytics", icon: <BarChartIcon /> },
      { path: "/session-map", label: "Session Map", icon: <HubIcon /> },
      { path: "/skills", label: "Skills", icon: <AccountTreeIcon /> },
    ],
  },
  {
    label: "Automation",
    items: [
      { path: "/agents", label: "Agents", icon: <SmartToyIcon /> },
      { path: "/intel", label: "Intel", icon: <TravelExploreIcon /> },
    ],
  },
];

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 260;

interface NavDrawerProps {
  open: boolean;
}

export function NavDrawer({ open }: NavDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const width = open ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
          overflowX: "hidden",
          transition: (theme) =>
            theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.easeInOut,
            }),
        },
      }}
    >
      <Box sx={{ height: 64 }} />
      <Divider />
      <Box sx={{ mt: 1, px: 1, overflowY: "auto", overflowX: "hidden" }}>
        {NAV_GROUPS.map((group, gi) => (
          <List
            key={gi}
            disablePadding
            subheader={
              group.label ? (
                open ? (
                  <ListSubheader
                    disableSticky
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      lineHeight: "32px",
                      bgcolor: "transparent",
                      mt: gi > 0 ? 0.5 : 0,
                    }}
                  >
                    {group.label}
                  </ListSubheader>
                ) : (
                  <Divider sx={{ my: 1 }} />
                )
              ) : undefined
            }
          >
            {group.items.map((item) => {
              const selected = location.pathname === item.path;
              return (
                <Tooltip
                  key={item.path}
                  title={open ? "" : item.label}
                  placement="right"
                >
                  <ListItemButton
                    selected={selected}
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 1,
                      minHeight: 44,
                      justifyContent: open ? "initial" : "center",
                      px: 1.5,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: open ? 36 : 0,
                        mr: open ? 1 : 0,
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {open && <ListItemText primary={item.label} />}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        ))}
      </Box>
    </Drawer>
  );
}
