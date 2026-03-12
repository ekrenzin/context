import { useState, useRef, useMemo, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, CircularProgress } from "@mui/material";
import { buildThemes, getInitialMode } from "./lib/theme";
import { BrandingContext, DEFAULT_BRANDING, fetchBranding, type BrandingConfig } from "./lib/branding";
import { ColorModeContext } from "./hooks/useColorMode";
import { MqttProvider } from "./hooks/useMqtt";
import { ProjectProvider } from "./hooks/useProject";
import { AppHeader } from "./components/AppHeader";
import { NavDrawer } from "./components/NavDrawer";
import { TerminalDrawer, type TerminalDrawerHandle } from "./components/TerminalDrawer";
import { views } from "./views/registry";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Onboarding = lazy(() => import("./views/Onboarding"));
const CreateProject = lazy(() => import("./views/CreateProject"));
const ProjectDashboard = lazy(() => import("./views/ProjectDashboard"));
const Feed = lazy(() => import("./views/Feed"));
const ProjectApprovals = lazy(() => import("./views/Approvals"));
const SolutionDetail = lazy(() => import("./views/SolutionDetail"));
const ProjectFiles = lazy(() => import("./views/ProjectFiles"));

function ViewFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
      <CircularProgress />
    </Box>
  );
}

/** Catches /terminal?session=...&label=... navigations, opens the drawer, and redirects back. */
function TerminalRedirect({ onOpen, onToggle }: { onOpen: (id: string, label: string) => void; onToggle: () => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get("session");
    const label = searchParams.get("label") ?? "Session";
    if (sessionId) {
      onOpen(sessionId, label);
    } else {
      onToggle();
    }
    navigate("/", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AppLayout({ onResetOnboarding }: { onResetOnboarding: () => void }) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const terminalRef = useRef<TerminalDrawerHandle>(null);
  const drawerWidth = 72;
  const terminalWidth = terminalOpen ? 520 : 0;

  /** Opens the terminal drawer and optionally attaches a session (used by /terminal route redirect). */
  function openTerminalSession(sessionId: string, label: string) {
    setTerminalOpen(true);
    // Small delay to ensure drawer is mounted before attaching
    setTimeout(() => terminalRef.current?.attachSession(sessionId, label), 50);
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <AppHeader onResetOnboarding={onResetOnboarding} />
      <NavDrawer onTerminalToggle={() => setTerminalOpen((p) => !p)} terminalOpen={terminalOpen} />
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
          width: `calc(100vw - ${drawerWidth}px - ${terminalWidth}px)`,
          transition: (theme) =>
            theme.transitions.create(["width", "margin"], {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.easeInOut,
            }),
        }}
      >
        <Suspense fallback={<ViewFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/solutions" replace />} />
            {views.map((v) => (
              <Route key={v.path} path={v.path} element={<v.component />} />
            ))}
            <Route path="/solutions/:id" element={<SolutionDetail />} />
            <Route path="/terminal" element={<TerminalRedirect onOpen={openTerminalSession} onToggle={() => setTerminalOpen(true)} />} />
            <Route path="/projects/new" element={<CreateProject />} />
            <Route path="/projects/:projectId" element={<ProjectProvider><ProjectDashboard /></ProjectProvider>} />
            <Route path="/projects/:projectId/feed" element={<ProjectProvider><Feed /></ProjectProvider>} />
            <Route path="/projects/:projectId/approvals" element={<ProjectProvider><ProjectApprovals /></ProjectProvider>} />
            <Route path="/projects/:projectId/files" element={<ProjectProvider><ProjectFiles /></ProjectProvider>} />
          </Routes>
        </Suspense>
      </Box>

      <TerminalDrawer ref={terminalRef} open={terminalOpen} onClose={() => setTerminalOpen(false)} />
    </Box>
  );
}

function OnboardingShell({ onComplete, onBrandingChange }: { onComplete: () => void; onBrandingChange: (cfg: BrandingConfig) => void }) {
  return (
    <Suspense fallback={<ViewFallback />}>
      <Onboarding onComplete={onComplete} onBrandingChange={onBrandingChange} />
    </Suspense>
  );
}

export function App() {
  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
  const [branding, setBranding] = useState<BrandingConfig>(
    () => window.__CTX_BRANDING__ ?? DEFAULT_BRANDING,
  );
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    fetchBranding().then(setBranding);
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setFirstRun(h.firstRun ?? false))
      .catch(() => setFirstRun(false));
  }, []);

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  const themes = useMemo(() => buildThemes(branding), [branding]);
  const theme = mode === "dark" ? themes.dark : themes.light;

  if (firstRun === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ViewFallback />
      </ThemeProvider>
    );
  }

  return (
    <BrandingContext.Provider value={branding}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MqttProvider>
            <ErrorBoundary>
              {firstRun ? <OnboardingShell onComplete={() => setFirstRun(false)} onBrandingChange={setBranding} /> : <AppLayout onResetOnboarding={() => setFirstRun(true)} />}
            </ErrorBoundary>
          </MqttProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </BrandingContext.Provider>
  );
}
