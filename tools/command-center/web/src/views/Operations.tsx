import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Tooltip,
  Skeleton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncIcon from "@mui/icons-material/Sync";
import DownloadIcon from "@mui/icons-material/Download";
import TerminalIcon from "@mui/icons-material/Terminal";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  api,
  type RepoEntry,
  type TunnelInstance,
  type DashboardConfig,
} from "../lib/api";
import { useMqttTopic, useVscodeCommand } from "../hooks/useMqtt";
import { MigrateCard } from "../components/MigrateCard";
import { EnvCard } from "../components/EnvCard";

export function Operations() {
  const send = useVscodeCommand();
  const [services, setServices] = useState<string[]>([]);
  const [tunnelsLocal, setTunnelsLocal] = useState<Record<string, TunnelInstance>>({});
  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [logService, setLogService] = useState("");
  const [logSince, setLogSince] = useState("1h");
  const [logFilter, setLogFilter] = useState("");

  const vscodeStatus = useMqttTopic<{ running: string[] }>("ctx/vscode/status");
  const mqttTunnels = useMqttTopic<Record<string, TunnelInstance>>("ctx/tunnels");
  const running = vscodeStatus?.running ?? [];
  const tunnels = mqttTunnels ?? tunnelsLocal;

  useEffect(() => {
    Promise.all([api.config(), api.tunnels(), api.repos()])
      .then(([cfg, tun, r]) => {
        setServices(cfg.services);
        setConfig(cfg.dashboard);
        setTunnelsLocal(tun.tunnels);
        setRepos(r);
        if (cfg.dashboard.logPrefixes.length > 0) {
          setLogService(cfg.dashboard.logPrefixes[0].value);
        }
        if (cfg.dashboard.logWindows.length > 1) {
          setLogSince(cfg.dashboard.logWindows[1]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Operations
        </Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rounded" height={200} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Operations
      </Typography>

      <Grid container spacing={3}>
        {/* Services */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">Services</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => send({ type: "vscode:startAll" })}
                  >
                    Start All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => send({ type: "vscode:restartAll" })}
                  >
                    Restart All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => send({ type: "vscode:stopAll" })}
                  >
                    Stop All
                  </Button>
                </Box>
              </Box>
              {services.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No services found. Add tasks with "group": "services" in
                  .vscode/tasks.json
                </Typography>
              ) : (
                services.map((label) => {
                  const isRunning = running.includes(label);
                  return (
                    <Box
                      key={label}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": { borderBottom: 0 },
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <FiberManualRecordIcon
                          sx={{
                            fontSize: 10,
                            color: isRunning ? "success.main" : "text.disabled",
                          }}
                        />
                        <Typography variant="body2">{label}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.25 }}>
                        {isRunning && (
                          <Tooltip title="Restart">
                            <IconButton
                              size="small"
                              onClick={() =>
                                send({ type: "vscode:restartTask", label })
                              }
                            >
                              <RestartAltIcon
                                fontSize="small"
                                color="warning"
                              />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={isRunning ? "Stop" : "Start"}>
                          <IconButton
                            size="small"
                            onClick={() =>
                              send({
                                type: isRunning
                                  ? "vscode:stopTask"
                                  : "vscode:startTask",
                                label,
                              })
                            }
                          >
                            {isRunning ? (
                              <StopIcon fontSize="small" color="error" />
                            ) : (
                              <PlayArrowIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tunnels */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">Tunnels</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Tooltip title="Start tunnels">
                    <IconButton
                      size="small"
                      onClick={() =>
                        send({
                          type: "vscode:openTerminal",
                          name: "SOS: Tunnels",
                          command: "npm run up",
                          cwd: "tools/tunnel",
                        })
                      }
                    >
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Stop tunnels">
                    <IconButton
                      size="small"
                      onClick={() =>
                        send({
                          type: "vscode:openTerminal",
                          name: "SOS: Tunnels",
                          command: "npm run down",
                          cwd: "tools/tunnel",
                        })
                      }
                    >
                      <StopIcon fontSize="small" color="error" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Refresh">
                    <IconButton
                      size="small"
                      onClick={() =>
                        api
                          .tunnels()
                          .then((t) => setTunnelsLocal(t.tunnels))
                          .catch(() => {})
                      }
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              {Object.keys(tunnels).length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No active tunnels. Click play to start.
                </Typography>
              ) : (
                Object.entries(tunnels).map(([name, inst]) => (
                  <Box
                    key={name}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:last-child": { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <FiberManualRecordIcon
                        sx={{
                          fontSize: 10,
                          color: inst.alive ? "success.main" : "error.main",
                        }}
                      />
                      <Typography variant="body2">{name}</Typography>
                      <Chip
                        label={`:${inst.port}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Tooltip title="Copy URL">
                      <IconButton
                        size="small"
                        onClick={() =>
                          send({
                            type: "vscode:copyText",
                            text: inst.fullUrl || inst.url,
                          })
                        }
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Repos */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">Repositories</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    onClick={() =>
                      repos
                        .filter((r) => r.present)
                        .forEach((r) =>
                          send({ type: "vscode:pullRepo", name: r.name }),
                        )
                    }
                  >
                    Pull All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() =>
                      repos
                        .filter((r) => r.present && r.installCommand)
                        .forEach((r) =>
                          send({ type: "vscode:installDeps", name: r.name }),
                        )
                    }
                  >
                    Install All
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Repository</TableCell>
                      <TableCell>Branch</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {repos.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <FiberManualRecordIcon
                              sx={{
                                fontSize: 10,
                                color: r.present
                                  ? "success.main"
                                  : "error.main",
                              }}
                            />
                            <Typography variant="body2" fontWeight={500}>
                              {r.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.branch}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {r.description}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {r.present && (
                            <Box
                              sx={{
                                display: "flex",
                                gap: 0.5,
                                justifyContent: "flex-end",
                              }}
                            >
                              <Tooltip title="Pull">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    send({
                                      type: "vscode:pullRepo",
                                      name: r.name,
                                    })
                                  }
                                >
                                  <SyncIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {r.installCommand && (
                                <Tooltip title="Install deps">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      send({
                                        type: "vscode:installDeps",
                                        name: r.name,
                                      })
                                    }
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Open terminal">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    send({
                                      type: "vscode:openTerminal",
                                      name: r.name,
                                    })
                                  }
                                >
                                  <TerminalIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Python Environment */}
        <Grid item xs={12} md={6}>
          <EnvCard />
        </Grid>

        {/* Database Migrations */}
        <Grid item xs={12} md={6}>
          <MigrateCard />
        </Grid>

        {/* Tests */}
        {config && config.tests.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tests
                </Typography>
                {config.tests.map((t) => (
                  <Box
                    key={t.name}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:last-child": { borderBottom: 0 },
                    }}
                  >
                    <Typography variant="body2">{t.name}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="Run">
                        <IconButton
                          size="small"
                          onClick={() =>
                            send({ type: "vscode:runTest", name: t.name })
                          }
                        >
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {t.watchCommand && (
                        <Tooltip title="Watch">
                          <IconButton
                            size="small"
                            onClick={() =>
                              send({
                                type: "vscode:runTest",
                                name: t.name,
                                watch: true,
                              })
                            }
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Logs */}
        {config && config.logPrefixes.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  CloudWatch Logs
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Service</InputLabel>
                    <Select
                      value={logService}
                      label="Service"
                      onChange={(e) => setLogService(e.target.value)}
                    >
                      {config.logPrefixes.map((p) => (
                        <MenuItem key={p.value} value={p.value}>
                          {p.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Since</InputLabel>
                    <Select
                      value={logSince}
                      label="Since"
                      onChange={(e) => setLogSince(e.target.value)}
                    >
                      {config.logWindows.map((w) => (
                        <MenuItem key={w} value={w}>
                          {w}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Filter"
                    placeholder="Error text, execution ID..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                  />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() =>
                        send({
                          type: "vscode:openLogs",
                          prefix: logService,
                          since: logSince,
                          filter: logFilter,
                          tail: false,
                        })
                      }
                    >
                      Fetch Logs
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        send({
                          type: "vscode:openLogs",
                          prefix: logService,
                          since: logSince,
                          filter: logFilter,
                          tail: true,
                        })
                      }
                    >
                      Tail Logs
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
