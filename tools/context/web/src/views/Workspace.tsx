import { lazy, Suspense } from "react";
import { Box, Tabs, Tab, CircularProgress } from "@mui/material";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";

const Projects = lazy(() => import("./Projects"));
const Solutions = lazy(() => import("./Solutions"));
const Proposals = lazy(() => import("./Proposals"));

const TAB_KEYS = ["projects", "solutions", "proposals"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

export default function Workspace() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const tab = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : "projects";
  const tabIndex = TAB_KEYS.indexOf(tab);

  return (
    <PageLayout title="Workspace" icon={<WorkspacesIcon color="primary" />}>
      <Tabs
        value={tabIndex}
        onChange={(_, idx) => setParams({ tab: TAB_KEYS[idx] })}
        sx={{ mb: 2 }}
      >
        <Tab label="Projects" />
        <Tab label="Solutions" />
        <Tab label="Proposals" />
      </Tabs>

      <Suspense fallback={<Loading />}>
        {tab === "projects" && <Projects embedded />}
        {tab === "solutions" && <Solutions embedded />}
        {tab === "proposals" && <Proposals />}
      </Suspense>
    </PageLayout>
  );
}
