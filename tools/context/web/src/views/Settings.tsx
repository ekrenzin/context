import { useState, useEffect } from "react";
import {
  Alert, Box, Button, Card, CardContent, IconButton, InputAdornment,
  Stack, TextField, Typography, Tabs, Tab,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useSearchParams } from "react-router-dom";
import { AiProviderCard, type SettingsData } from "../components/settings/AiProviderCard";
import { OllamaCard } from "../components/settings/OllamaCard";
import { BrandingCard } from "../components/settings/BrandingCard";
import { TerminalDefaultsCard } from "../components/settings/TerminalDefaultsCard";
import { CliToolsCard } from "../components/settings/CliToolsCard";
import { RemoteAccessCard } from "../components/settings/RemoteAccessCard";
import { PageLayout } from "../components/PageLayout";
import { LoginForm } from "../components/settings/LoginGate";
import { useAuth } from "../hooks/useAuth";
import LogoutIcon from "@mui/icons-material/Logout";

const TAB_KEYS = ["providers", "integrations", "appearance", "general", "account"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function useSettings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  async function save() {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function testKey(provider: "anthropic" | "openai") {
    const key = provider === "anthropic"
      ? settings.anthropic_api_key
      : settings.openai_api_key;
    if (!key) return;

    setTesting(provider);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const text = await res.text();
      if (!text) { setTestResult("Error: empty response from server"); return; }
      let data: { ok: boolean; model?: string; error?: string };
      try { data = JSON.parse(text); } catch { setTestResult(`Error: server returned non-JSON (${res.status})`); return; }
      setTestResult(data.ok ? `Connected: ${data.model}` : `Failed: ${data.error}`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(null);
    }
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleVisible(key: string) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return { settings, saved, error, testing, testResult, setTestResult, visible, save, testKey, update, toggleVisible };
}

function ProvidersTab({ s }: { s: ReturnType<typeof useSettings> }) {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <AiProviderCard
        settings={s.settings}
        visible={s.visible}
        testing={s.testing}
        onUpdate={s.update}
        onTestKey={s.testKey}
        onToggleVisible={s.toggleVisible}
      />
      <OllamaCard
        selectedModel={s.settings.ollama_model ?? ""}
        onModelChange={(model) => s.update("ollama_model", model)}
      />
    </Box>
  );
}

function IntegrationsTab({ s }: { s: ReturnType<typeof useSettings> }) {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>GitHub</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Personal access token with repo scope.
          </Typography>
          <TextField
            fullWidth label="GitHub Personal Access Token"
            type={s.visible.github ? "text" : "password"}
            value={s.settings.github_token ?? ""}
            onChange={(e) => s.update("github_token", e.target.value)}
            placeholder="ghp_..."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => s.toggleVisible("github")} edge="end" size="small">
                      {s.visible.github ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </CardContent>
      </Card>
      <RemoteAccessCard
        remoteEnabled={s.settings.remote_access_enabled ?? "true"}
        tunnelName={s.settings.tunnel_name ?? ""}
        tunnelPin={s.settings.tunnel_pin ?? ""}
        onUpdate={s.update}
      />
      <CliToolsCard />
    </Box>
  );
}

function AppearanceTab() {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <BrandingCard />
    </Box>
  );
}

function GeneralTab({ s }: { s: ReturnType<typeof useSettings> }) {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Profiler Mode</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Auto-apply writes improvements directly. Suggest-only flags them for review.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant={s.settings.profiler_mode === "auto" ? "contained" : "outlined"}
              onClick={() => s.update("profiler_mode", "auto")}
              disableElevation
            >
              Auto-apply
            </Button>
            <Button
              variant={s.settings.profiler_mode !== "auto" ? "contained" : "outlined"}
              onClick={() => s.update("profiler_mode", "suggest")}
              disableElevation
            >
              Suggest only
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <TerminalDefaultsCard
        value={s.settings.default_terminal_project ?? ""}
        onChange={(id) => s.update("default_terminal_project", id)}
      />
    </Box>
  );
}

function AccountTab() {
  const { user, signOut, configured } = useAuth();

  if (!configured) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Authentication is not configured.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (user) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Signed in as {user.email}
            </Typography>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={signOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return <LoginForm />;
}

function SettingsContent() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const tab = TAB_KEYS.includes(raw as TabKey) ? (raw as TabKey) : "providers";
  const tabIndex = TAB_KEYS.indexOf(tab);

  const s = useSettings();

  return (
    <>
      {s.saved && <Alert severity="success" sx={{ mb: 2 }}>Saved</Alert>}
      {s.error && <Alert severity="error" sx={{ mb: 2 }}>{s.error}</Alert>}
      {s.testResult && (
        <Alert
          severity={s.testResult.startsWith("Connected") ? "success" : "error"}
          sx={{ mb: 2 }}
          onClose={() => s.setTestResult(null)}
        >
          {s.testResult}
        </Alert>
      )}

      <Tabs value={tabIndex} onChange={(_, idx) => setParams({ tab: TAB_KEYS[idx] })} sx={{ mb: 2 }}>
        <Tab label="AI Providers" />
        <Tab label="Integrations" />
        <Tab label="Appearance" />
        <Tab label="General" />
        <Tab label="Account" />
      </Tabs>

      {tab === "providers" && <ProvidersTab s={s} />}
      {tab === "integrations" && <IntegrationsTab s={s} />}
      {tab === "appearance" && <AppearanceTab />}
      {tab === "general" && <GeneralTab s={s} />}
      {tab === "account" && <AccountTab />}

      {tab !== "account" && (
        <Box sx={{ maxWidth: 720, mx: "auto", mt: 3 }}>
          <Button variant="contained" fullWidth onClick={s.save} disableElevation>
            Save Settings
          </Button>
        </Box>
      )}
    </>
  );
}

export default function Settings() {
  return (
    <PageLayout title="Settings" icon={<SettingsIcon color="primary" />}>
      <SettingsContent />
    </PageLayout>
  );
}
