import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Chip,
  Stack,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { TerminalPanel } from "./TerminalPanel";

export interface TerminalTab {
  id: string;
  label: string;
  command: string;
  exitCode?: number;
}

export interface TerminalPreset {
  label: string;
  command: string;
  args: string[];
  icon: React.ReactNode;
}

interface Props {
  activeTab: number;
  drawerDragging?: boolean;
  menuAnchor: HTMLElement | null;
  open: boolean;
  presets: TerminalPreset[];
  setActiveTab: (index: number) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  tabs: TerminalTab[];
  onClose: () => void;
  onExit: (index: number, code: number) => void;
  onSpawn: (command: string, args: string[], label: string) => void;
  onTabClose: (index: number) => void;
}

export function TerminalDrawerContent({
  activeTab,
  drawerDragging,
  menuAnchor,
  open,
  presets,
  setActiveTab,
  setMenuAnchor,
  tabs,
  onClose,
  onExit,
  onSpawn,
  onTabClose,
}: Props) {
  if (tabs.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 2,
          px: 3,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Terminal
        </Typography>
        <Typography color="text.secondary" sx={{ textAlign: "center", fontSize: 14 }}>
          Run Claude Code, Codex, or a shell alongside any view.
        </Typography>
        <Stack direction="column" spacing={1} sx={{ width: "100%" }}>
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="outlined"
              startIcon={preset.icon}
              onClick={() => onSpawn(preset.command, preset.args, preset.label)}
              fullWidth
            >
              {preset.label}
            </Button>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          minHeight: 42,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minHeight: 42, "& .MuiTab-root": { minHeight: 42, py: 0 } }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <span>{tab.label}</span>
                  {tab.exitCode !== undefined && (
                    <Chip
                      size="small"
                      label={`exit ${tab.exitCode}`}
                      color={tab.exitCode === 0 ? "success" : "error"}
                      sx={{ height: 18, fontSize: 11 }}
                    />
                  )}
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTabClose(index);
                    }}
                    sx={{ ml: 0.5, p: 0.25 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              }
            />
          ))}
        </Tabs>
        <IconButton
          size="small"
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ mr: 0.5 }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onClose} sx={{ mr: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {presets.map((preset) => (
            <MenuItem
              key={preset.label}
              onClick={() => onSpawn(preset.command, preset.args, preset.label)}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {preset.icon}
                <span>{preset.label}</span>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Box sx={{ flex: 1, position: "relative" }}>
        {tabs.map((tab, index) => (
          <Box
            key={tab.id}
            sx={{
              position: "absolute",
              inset: 0,
              display: index === activeTab ? "block" : "none",
            }}
          >
            <TerminalPanel
              sessionId={tab.id}
              active={open && index === activeTab}
              suspendResize={drawerDragging}
              onExit={(code) => onExit(index, code)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
