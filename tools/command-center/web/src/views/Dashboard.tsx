import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Divider,
  Stack,
  Skeleton,
  Alert,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import BoltIcon from "@mui/icons-material/Bolt";
import StorageIcon from "@mui/icons-material/Storage";
import GitHubIcon from "@mui/icons-material/GitHub";
import CloudIcon from "@mui/icons-material/Cloud";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SyncIcon from "@mui/icons-material/Sync";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import PaletteIcon from "@mui/icons-material/Palette";
import type {
  DashboardConfig,
  IdentityProvider,
  IdentitySnapshot,
} from "../lib/api";
import { api } from "../lib/api";
import { useMqttTopic, useVscodeCommand } from "../hooks/useMqtt";
import { useColorMode } from "../hooks/useColorMode";

interface LoadedData {
  services: string[];
  config: DashboardConfig | null;
  identities: IdentitySnapshot | null;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <FiberManualRecordIcon
      sx={{ fontSize: 10, color: active ? "success.main" : "text.disabled" }}
    />
  );
}

function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardHeader
        avatar={icon}
        title={
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        }
        action={action}
        sx={{ pb: 0 }}
      />
      <Divider sx={{ mx: 2 }} />
      <CardContent sx={{ pt: 1.5 }}>{children}</CardContent>
    </Card>
  );
}

function ServiceRow({
  label,
  running,
  onStart,
  onStop,
  onRestart,
}: {
  label: string;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <StatusDot active={running} />
        <Typography variant="body2">{label}</Typography>
        {running && (
          <Chip
            label="running"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 18, fontSize: "0.65rem" }}
          />
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 0.25 }}>
        {running && (
          <Tooltip title="Restart">
            <IconButton size="small" onClick={onRestart}>
              <RestartAltIcon fontSize="small" color="warning" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={running ? "Stop" : "Start"}>
          <IconButton size="small" onClick={running ? onStop : onStart}>
            {running ? (
              <StopIcon fontSize="small" color="error" />
            ) : (
              <PlayArrowIcon fontSize="small" color="primary" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function IdentityStatusIcon({
  status,
}: {
  status: IdentityProvider["status"];
}) {
  if (status === "connected")
    return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  if (status === "disconnected")
    return <ErrorOutlineIcon fontSize="small" color="error" />;
  return <HelpOutlineIcon fontSize="small" color="disabled" />;
}

function ProviderIcon({
  provider,
}: {
  provider: IdentityProvider["provider"];
}) {
  if (provider === "github") return <GitHubIcon fontSize="small" />;
  if (provider === "aws") return <CloudIcon fontSize="small" />;
  return <PersonIcon fontSize="small" />;
}

function IdentityRow({ identity }: { identity: IdentityProvider }) {
  const label =
    identity.username ?? identity.displayName ?? identity.accountId ?? "—";
  const sublabel = identity.team ?? identity.email ?? identity.detail ?? null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}
      >
        <ProviderIcon provider={identity.provider} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{ textTransform: "capitalize" }}
          >
            {identity.provider}
          </Typography>
          {identity.status === "connected" && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {label}
              {sublabel ? ` · ${sublabel}` : ""}
            </Typography>
          )}
          {identity.status !== "connected" && (
            <Typography variant="caption" color="text.secondary">
              {identity.detail ?? identity.status}
            </Typography>
          )}
        </Box>
      </Box>
      <IdentityStatusIcon status={identity.status} />
    </Box>
  );
}

export function Dashboard() {
  const send = useVscodeCommand();
  const { mode, toggle } = useColorMode();
  const [data, setData] = useState<LoadedData>({
    services: [],
    config: null,
    identities: null,
  });
  const [loading, setLoading] = useState(true);

  const vscodeStatus = useMqttTopic<{ running: string[] }>("ctx/vscode/status");
  const running = vscodeStatus?.running ?? [];

  useEffect(() => {
    Promise.all([api.config(), api.identities()])
      .then(([cfg, ids]) => {
        setData({
          services: cfg.services,
          config: cfg.dashboard,
          identities: ids,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runningCount = running.length;
  const totalServices = data.services.length;
  const actions = data.config?.actions ?? [];
  const identityList = data.identities
    ? [data.identities.github, data.identities.cursor, data.identities.aws]
    : [];
  const connectedCount = identityList.filter(
    (i) => i.status === "connected",
  ).length;

  if (loading) {
    return (
      <Box sx={{ pt: 3 }}>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Command Center
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            icon={
              <FiberManualRecordIcon sx={{ fontSize: "10px !important" }} />
            }
            label={`${runningCount}/${totalServices} services`}
            color={runningCount > 0 ? "success" : "default"}
            variant="outlined"
          />
          <Chip
            size="small"
            icon={
              <CheckCircleOutlineIcon sx={{ fontSize: "12px !important" }} />
            }
            label={`${connectedCount}/3 connected`}
            color={
              connectedCount === 3
                ? "success"
                : connectedCount > 0
                  ? "warning"
                  : "default"
            }
            variant="outlined"
          />
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {/* Identities */}
        <Grid item xs={12} md={actions.length > 0 ? 6 : 6}>
          <SectionCard
            title="Connections"
            icon={<PersonIcon fontSize="small" color="primary" />}
            action={
              <Tooltip title="Refresh identities">
                <IconButton
                  size="small"
                  sx={{ mr: 1 }}
                  onClick={() =>
                    api
                      .identities()
                      .then((ids) =>
                        setData((prev) => ({ ...prev, identities: ids })),
                      )
                      .catch(() => {})
                  }
                >
                  <SyncIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            {identityList.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                Identity data unavailable.
              </Alert>
            ) : (
              identityList.map((identity) => (
                <IdentityRow key={identity.provider} identity={identity} />
              ))
            )}
          </SectionCard>
        </Grid>

        {/* Services */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Services"
            icon={<StorageIcon fontSize="small" color="primary" />}
            action={
              <Box sx={{ display: "flex", gap: 1, pr: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={() => send("vscode:startAll")}
                >
                  Start All
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => send("vscode:restartAll")}
                >
                  Restart All
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => send("vscode:stopAll")}
                >
                  Stop All
                </Button>
              </Box>
            }
          >
            {data.services.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No services configured. Add tasks with{" "}
                <code>"group": "services"</code> in{" "}
                <code>.vscode/tasks.json</code>.
              </Alert>
            ) : (
              data.services.map((label) => (
                <ServiceRow
                  key={label}
                  label={label}
                  running={running.includes(label)}
                  onStart={() => send("vscode:startTask", { label })}
                  onStop={() => send("vscode:stopTask", { label })}
                  onRestart={() => send("vscode:restartTask", { label })}
                />
              ))
            )}
          </SectionCard>
        </Grid>

        {/* Quick Actions */}
        {actions.length > 0 && (
          <Grid item xs={12} md={4}>
            <SectionCard
              title="Quick Actions"
              icon={<BoltIcon fontSize="small" color="primary" />}
            >
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{ justifyContent: "flex-start", textTransform: "none" }}
                    onClick={() =>
                      send("vscode:openTerminal", {
                        name: action.label,
                        command: action.command,
                        cwd: action.cwd,
                      })
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        )}

        {/* Appearance */}
        <Grid item xs={12} md={4}>
          <SectionCard
            title="Appearance"
            icon={<PaletteIcon fontSize="small" color="primary" />}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 0.75,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {mode === "dark" ? (
                  <Brightness4Icon fontSize="small" />
                ) : (
                  <Brightness7Icon fontSize="small" />
                )}
                <Typography variant="body2">
                  {mode === "dark" ? "Dark mode" : "Light mode"}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={toggle}
                sx={{ textTransform: "none" }}
              >
                Switch to {mode === "dark" ? "light" : "dark"}
              </Button>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
