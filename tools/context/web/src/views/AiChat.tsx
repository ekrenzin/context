import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { Box, Tabs, Tab, Chip, CircularProgress, Stack } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { api, type AiModelOption } from "../lib/api";

const CloudChat = lazy(() =>
  import("../components/chat/CloudChat").then((m) => ({ default: m.CloudChat })),
);
const LocalChat = lazy(() =>
  import("../components/chat/LocalChat").then((m) => ({ default: m.LocalChat })),
);

const TAB_KEYS = ["cloud", "local"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const PROVIDERS = [
  { id: "anthropic", label: "Claude" },
  { id: "openai", label: "ChatGPT" },
] as const;

function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

export default function AiChat() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const tab = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : "cloud";
  const tabIndex = TAB_KEYS.indexOf(tab);

  const [models, setModels] = useState<AiModelOption[]>([]);

  useEffect(() => {
    api.aiModels()
      .then(({ models: m }) => setModels(m))
      .catch(() => setModels([]));
  }, []);

  const enabledProviders = useMemo(
    () => new Set(models.map((m) => m.provider)),
    [models],
  );

  return (
    <PageLayout
      title="AI"
      icon={<ChatBubbleOutlineIcon color="primary" />}
      maxWidth={1100}
      actions={
        <Stack direction="row" spacing={1}>
          {PROVIDERS.map((p) => {
            const connected = enabledProviders.has(p.id);
            return (
              <Chip
                key={p.id}
                icon={
                  <FiberManualRecordIcon
                    sx={{
                      fontSize: 10,
                      color: connected ? "success.main" : "error.main",
                    }}
                  />
                }
                label={`${p.label}: ${connected ? "Connected" : "Disconnected"}`}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: connected ? "success.main" : "error.main",
                  color: connected ? "success.main" : "error.main",
                }}
              />
            );
          })}
        </Stack>
      }
    >
      <Tabs
        value={tabIndex}
        onChange={(_, idx) => setParams({ tab: TAB_KEYS[idx] })}
        sx={{ mb: 2 }}
      >
        <Tab label="Cloud" />
        <Tab label="Local" />
      </Tabs>

      <Box sx={{ height: "calc(100vh - 240px)" }}>
        <Suspense fallback={<Loading />}>
          {tab === "cloud" && <CloudChat models={models} />}
          {tab === "local" && <LocalChat />}
        </Suspense>
      </Box>
    </PageLayout>
  );
}
