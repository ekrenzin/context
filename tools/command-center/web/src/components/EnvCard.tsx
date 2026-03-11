import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { api, type EnvStatus } from "../lib/api";

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
  ) : (
    <CancelIcon sx={{ fontSize: 16, color: "error.main" }} />
  );
}

function StatusRow({
  label,
  ok,
  detail,
  action,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  action?: React.ReactNode;
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
        <StatusIcon ok={ok} />
        <Typography variant="body2">{label}</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {detail && (
          <Chip label={detail} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
        )}
        {action}
      </Box>
    </Box>
  );
}

export function EnvCard() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; output: string } | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  const refresh = () => {
    setLoading(true);
    api
      .env()
      .then(setEnv)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const runBootstrap = (extras?: string) => {
    const label = extras ?? "core";
    setInstalling(label);
    setResult(null);
    api
      .bootstrap(extras)
      .then((res) => {
        setEnv(res.env);
        setResult({ success: res.success, output: res.output });
        if (!res.success) setShowOutput(true);
      })
      .catch((err) => {
        setResult({ success: false, output: err.message });
        setShowOutput(true);
      })
      .finally(() => setInstalling(null));
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Checking environment...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!env) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Failed to check environment status.</Alert>
        </CardContent>
      </Card>
    );
  }

  const allInstalled = env.deps.every((d) => d.installed);

  const installIcon = (group: string) => {
    if (installing === group) {
      return <CircularProgress size={14} />;
    }
    return (
      <Tooltip title={`Install ${group}`}>
        <IconButton
          size="small"
          disabled={!!installing}
          onClick={() => runBootstrap(group)}
        >
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="h6">Python Environment</Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {env.cliInstalled && !allInstalled && (
              <Tooltip title="Install all extras">
                <IconButton
                  size="small"
                  disabled={!!installing}
                  onClick={() => runBootstrap("all")}
                >
                  {installing === "all" ? (
                    <CircularProgress size={16} />
                  ) : (
                    <DownloadIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={refresh} disabled={!!installing}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <StatusRow
          label="Python"
          ok={!!env.pythonVersion}
          detail={env.pythonVersion ?? "not found"}
        />
        <StatusRow label="Virtual environment" ok={env.venvExists} />
        <StatusRow
          label="SOS CLI"
          ok={env.cliInstalled}
          action={
            !env.cliInstalled ? (
              <Tooltip title="Install">
                <IconButton
                  size="small"
                  disabled={!!installing}
                  onClick={() => runBootstrap()}
                >
                  {installing === "core" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <DownloadIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : undefined
          }
        />

        {env.cliInstalled && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }} color="text.secondary">
              Optional Dependencies
            </Typography>

            {env.deps.map((dep) => (
              <StatusRow
                key={dep.name}
                label={dep.name}
                ok={dep.installed}
                detail={dep.group}
                action={!dep.installed ? installIcon(dep.group) : undefined}
              />
            ))}

            {allInstalled && (
              <Box sx={{ mt: 1 }}>
                <Chip label="All extras installed" size="small" color="success" variant="outlined" />
              </Box>
            )}
          </>
        )}

        {result && (
          <Box sx={{ mt: 1.5 }}>
            <Alert
              severity={result.success ? "success" : "error"}
              action={
                <IconButton size="small" onClick={() => setShowOutput((v) => !v)}>
                  {showOutput ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              }
            >
              {result.success ? "Bootstrap completed." : "Bootstrap failed."}
            </Alert>
            <Collapse in={showOutput}>
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: "auto",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.output}
              </Box>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
