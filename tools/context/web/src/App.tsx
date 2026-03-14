import { useState, useRef, useMemo, useEffect, Suspense, lazy } from "react";
import { Routes, Route, useSearchParams, useNavigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box, CircularProgress } from "@mui/material";
import { buildThemes, getInitialMode } from "./lib/theme";
import { BrandingContext, SetBrandingContext, DEFAULT_BRANDING, fetchBranding, type BrandingConfig } from "./lib/branding";
import { ColorModeContext } from "./hooks/useColorMode";
import { MqttProvider } from "./hooks/useMqtt";
import { ProjectProvider } from "./hooks/useProject";
import { AppHeader } from "./components/AppHeader";
import { NavDrawer } from "./components/NavDrawer";
import { TerminalDrawer, type TerminalDrawerHandle } from "./components/TerminalDrawer";
import { MediaFab } from "./components/MediaFab";
import { TerminalActionFab } from "./components/TerminalActionFab";
import { TerminalActionModal } from "./components/TerminalActionModal";
import { usePreviewEntries } from "./hooks/usePreviewEntries";
import { useTerminalActions } from "./hooks/useTerminalActions";
import { views } from "./views/registry";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/GuidedTour";
import { AuthProvider } from "./hooks/useAuth";
import { TunnelAuthProvider } from "./hooks/useTunnelAuth";
import { TunnelPinModal } from "./components/TunnelPinModal";

const Onboarding = lazy(() => import("./views/Onboarding"));
import type { PendingSession } from "./views/Onboarding";
const CreateProject = lazy(() => import("./views/CreateProject"));
const ProjectDashboard = lazy(() => import("./views/ProjectDashboard"));
const Feed = lazy(() => import("./views/Feed"));
const ProjectApprovals = lazy(() => import("./views/Approvals"));
const SolutionDetail = lazy(() => import("./views/SolutionDetail"));
const ProposalDetail = lazy(() => import("./views/ProposalDetail"));

function ViewFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
      <CircularProgress />
    </Box>
  );
}

/** Restores the last visited route on cold start, falling back to /workspace. */
function RestoreRoute() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("./hooks/useNavHistory").then(({ fetchNavState }) =>
      fetchNavState().then(({ current }) => {
        const target = current?.path ? current.path + (current.search ?? "") : "/workspace";
        navigate(target, { replace: true });
        setReady(true);
      }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <ViewFallback />;
  return null;
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

function AppLayout({ onResetOnboarding, showTour, onTourComplete, pendingSession }: { onResetOnboarding: () => void; showTour: boolean; onTourComplete: () => void; pendingSession?: PendingSession | null }) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const terminalRef = useRef<TerminalDrawerHandle>(null);

  // Auto-open terminal drawer if a session was handed off from onboarding
  useEffect(() => {
    if (!pendingSession) return;
    // Small delay so the drawer mounts first
    const timer = setTimeout(() => {
      setTerminalOpen(true);
      setTimeout(() => terminalRef.current?.attachSession(pendingSession.id, pendingSession.label), 100);
    }, 300);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { entries: previewEntries, unseenCount, shaking, markSeen } = usePreviewEntries();
  const { actions: terminalActions, completeAction } = useTerminalActions();
  const [actionModalOpen, setActionModalOpen] = useState(false);

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
        }}
      >
        <Suspense fallback={<ViewFallback />}>
          <Routes>
            <Route path="/" element={<RestoreRoute />} />
            {views.map((v) => (
              <Route key={v.path} path={v.path} element={<ErrorBoundary label={v.label ?? v.path}><v.component /></ErrorBoundary>} />
            ))}
            {/* Detail routes */}
            <Route path="/solutions/:id" element={<ErrorBoundary label="Solution Detail"><SolutionDetail /></ErrorBoundary>} />
            <Route path="/proposals/:slug" element={<ErrorBoundary label="Proposal Detail"><ProposalDetail /></ErrorBoundary>} />
            <Route path="/projects/new" element={<ErrorBoundary label="Create Project"><CreateProject /></ErrorBoundary>} />
            <Route path="/projects/:projectId" element={<ProjectProvider><ErrorBoundary label="Project Dashboard"><ProjectDashboard /></ErrorBoundary></ProjectProvider>} />
            <Route path="/projects/:projectId/feed" element={<ProjectProvider><ErrorBoundary label="Feed"><Feed /></ErrorBoundary></ProjectProvider>} />
            <Route path="/projects/:projectId/approvals" element={<ProjectProvider><ErrorBoundary label="Approvals"><ProjectApprovals /></ErrorBoundary></ProjectProvider>} />
            <Route path="/terminal" element={<TerminalRedirect onOpen={openTerminalSession} onToggle={() => setTerminalOpen(true)} />} />
          </Routes>
        </Suspense>
      </Box>

      <TerminalDrawer ref={terminalRef} open={terminalOpen} onClose={() => setTerminalOpen(false)} highlight={!!pendingSession && terminalOpen} />
      <MediaFab entries={previewEntries} unseenCount={unseenCount} shaking={shaking} onOpen={markSeen} />
      <TerminalActionFab
        count={terminalActions.length}
        hasMediaFab={previewEntries.length > 0}
        onClick={() => setActionModalOpen(true)}
      />
      <TerminalActionModal
        action={terminalActions[0] ?? null}
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        onDone={(id) => { completeAction(id); setActionModalOpen(false); }}
      />
      <GuidedTour active={showTour} onComplete={onTourComplete} onCloseTerminal={() => setTerminalOpen(false)} />
    </Box>
  );
}

function OnboardingShell({ onComplete, onBrandingChange }: { onComplete: (session?: PendingSession) => void; onBrandingChange: (cfg: BrandingConfig) => void }) {
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
  const [showTour, setShowTour] = useState(false);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);

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
      <SetBrandingContext.Provider value={setBranding}>
        <ColorModeContext.Provider value={colorMode}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <TunnelAuthProvider>
            <AuthProvider>
            <MqttProvider>
              <ErrorBoundary>
                {firstRun ? (
                  <OnboardingShell
                    onComplete={(session) => { setPendingSession(session ?? null); setFirstRun(false); setShowTour(true); }}
                    onBrandingChange={setBranding}
                  />
                ) : (
                  <AppLayout
                    onResetOnboarding={() => setFirstRun(true)}
                    showTour={showTour}
                    onTourComplete={() => setShowTour(false)}
                    pendingSession={pendingSession}
                  />
                )}
              </ErrorBoundary>
              <TunnelPinModal />
            </MqttProvider>
            </AuthProvider>
            </TunnelAuthProvider>
          </ThemeProvider>
        </ColorModeContext.Provider>
      </SetBrandingContext.Provider>
    </BrandingContext.Provider>
  );
}
