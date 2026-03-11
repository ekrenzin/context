import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UndoIcon from "@mui/icons-material/Undo";
import StorageIcon from "@mui/icons-material/Storage";
import { api, type MigrateEnvironment, type MigrateResult } from "../lib/api";

export function MigrateCard() {
  const [envs, setEnvs] = useState<MigrateEnvironment[]>([]);
  const [selected, setSelected] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.migrateEnvironments()
      .then((list) => {
        setEnvs(list);
        if (list.length > 0) setSelected(list[0].script);
      })
      .catch(() => setError("Could not load migration environments. Is app-platform checked out?"));
  }, []);

  async function run(undo: boolean) {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.migrate(selected, undo);
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  if (error && envs.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <StorageIcon />
            <Typography variant="h6">Database Migrations</Typography>
          </Box>
          <Alert severity="warning">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <StorageIcon />
          <Typography variant="h6">Database Migrations</Typography>
          {running && <CircularProgress size={18} sx={{ ml: "auto" }} />}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Environment</InputLabel>
            <Select
              value={selected}
              label="Environment"
              onChange={(e) => setSelected(e.target.value)}
              disabled={running}
            >
              {envs.map((env) => (
                <MenuItem key={env.script} value={env.script}>
                  {env.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={() => run(false)}
              disabled={running || !selected}
            >
              Migrate
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              startIcon={<UndoIcon />}
              onClick={() => run(true)}
              disabled={running || !selected}
            >
              Undo
            </Button>
          </Box>

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {result && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Chip
                  label={result.success ? "Success" : "Failed"}
                  color={result.success ? "success" : "error"}
                  size="small"
                />
                {result.exitCode !== 0 && result.exitCode != null && (
                  <Typography variant="caption" color="text.secondary">
                    exit {result.exitCode}
                  </Typography>
                )}
              </Box>
              <Box
                component="pre"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: "background.default",
                  border: 1,
                  borderColor: "divider",
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflow: "auto",
                  maxHeight: 280,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  m: 0,
                }}
              >
                {result.output}
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
