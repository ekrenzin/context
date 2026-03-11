import { useState, useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { darkTheme, lightTheme, getInitialMode } from "./lib/theme";
import { ColorModeContext } from "./hooks/useColorMode";
import { MqttProvider, useMqttConnected } from "./hooks/useMqtt";
import { useIdentities } from "./hooks/useIdentities";
import { AppHeader } from "./components/AppHeader";
import { NavDrawer } from "./components/NavDrawer";
import { Dashboard } from "./views/Dashboard";
import { Sessions } from "./views/Sessions";
import { Analytics } from "./views/Analytics";
import { Operations } from "./views/Operations";
import { SkillGraph } from "./views/SkillGraph";
import { SessionMap } from "./views/SessionMap";
import { Agents } from "./views/Agents";
import { Intel } from "./views/Intel";
import { DevDb } from "./views/DevDb";
import { Logs } from "./views/Logs";

function AppLayout() {
  const mqttConnected = useMqttConnected();
  const identities = useIdentities();
  const connected = mqttConnected;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = drawerOpen ? 260 : 72;

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <AppHeader
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
        socketConnected={connected}
        identities={identities}
      />
      <NavDrawer open={drawerOpen} />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          pt: "64px",
          px: 3,
          pb: 3,
          ml: 0,
          width: `calc(100vw - ${drawerWidth}px)`,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/skills" element={<SkillGraph />} />
          <Route path="/session-map" element={<SessionMap />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/intel" element={<Intel />} />

          <Route path="/logs" element={<Logs />} />
          <Route path="/dev-db" element={<DevDb />} />
        </Routes>
      </Box>
    </Box>
  );
}

export function App() {
  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  const theme = mode === "dark" ? darkTheme : lightTheme;

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MqttProvider>
          <AppLayout />
        </MqttProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
