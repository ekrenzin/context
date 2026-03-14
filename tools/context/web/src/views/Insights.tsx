import { lazy, Suspense, useCallback } from "react";
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useSearchParams } from "react-router-dom";
import { useRefetchOnMqtt } from "../hooks/useRefetchOnMqtt";
import { PageLayout } from "../components/PageLayout";

const Overview = lazy(() => import("../components/viz/Dashboard"));
const SkillGraph = lazy(() => import("../components/viz/SkillGraph"));
const SessionMap = lazy(() => import("../components/viz/SessionMap"));
const SessionLogs = lazy(() => import("./SessionLogs"));
const Processes = lazy(() => import("./Processes"));

const TAB_KEYS = ["overview", "skills", "sessions", "logs", "system"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <CircularProgress />
    </Box>
  );
}

const FULLSCREEN_TABS = new Set<TabKey>(["skills", "sessions"]);

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const tab = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : "overview";
  const tabIndex = TAB_KEYS.indexOf(tab);
  const isFullscreen = FULLSCREEN_TABS.has(tab);

  const { generation, bump } = useRefetchOnMqtt("ctx/sessions/+");

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, idx: number) => {
      setParams({ tab: TAB_KEYS[idx] });
    },
    [setParams],
  );

  return (
    <Box
      sx={{
        pt: 2,
        display: "flex",
        flexDirection: "column",
        ...(isFullscreen
          ? { height: "calc(100vh - 64px)", overflow: "hidden" }
          : { minHeight: "calc(100vh - 64px)" }),
      }}
    >
      <PageLayout
        title="Dashboard"
        icon={<AnalyticsIcon color="primary" />}
        sx={
          isFullscreen
            ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
            : undefined
        }
        actions={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={bump}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2, flexShrink: 0 }}>
            <Tab label="Overview" />
            <Tab label="Skill Graph" />
            <Tab label="Session Map" />
            <Tab label="Session Logs" />
            <Tab label="System" />
          </Tabs>

          <Box sx={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
            <Suspense fallback={<Loading />}>
              {tab === "overview" && <Overview generation={generation} />}
              {tab === "skills" && <SkillGraph />}
              {tab === "sessions" && <SessionMap />}
              {tab === "logs" && <SessionLogs />}
              {tab === "system" && <Processes />}
            </Suspense>
          </Box>
        </Box>
      </PageLayout>
    </Box>
  );
}
