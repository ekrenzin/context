import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export interface SettingsData {
  ai_provider?: string;
  claude_auth_mode?: string;
  codex_auth_mode?: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
  github_token?: string;
  profiler_mode?: string;
  ollama_model?: string;
  default_terminal_project?: string;
  remote_access_enabled?: string;
  tunnel_enabled?: string;
  tunnel_name?: string;
  tunnel_pin?: string;
}

interface Props {
  settings: SettingsData;
  visible: Record<string, boolean>;
  testing: string | null;
  onUpdate: (key: string, value: string) => void;
  onTestKey: (provider: "anthropic" | "openai") => void;
  onToggleVisible: (key: string) => void;
}

function ApiKeyRow(props: {
  label: string;
  visibilityKey: "anthropic" | "openai";
  value: string;
  placeholder: string;
  testing: boolean;
  onChange: (value: string) => void;
  onTest: () => void;
  onToggleVisible: () => void;
  visible: boolean;
}) {
  const {
    label,
    visibilityKey,
    value,
    placeholder,
    testing,
    onChange,
    onTest,
    onToggleVisible,
    visible,
  } = props;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
      <TextField
        fullWidth
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={`toggle ${visibilityKey} key visibility`}
                  onClick={onToggleVisible}
                  edge="end"
                  size="small"
                >
                  {visible ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Button
        variant="outlined"
        size="small"
        disabled={!value || testing}
        onClick={onTest}
        sx={{ minWidth: 80, height: 56 }}
      >
        {testing ? <CircularProgress size={20} /> : "Test"}
      </Button>
    </Box>
  );
}

export function AiProviderCard({
  settings,
  visible,
  testing,
  onUpdate,
  onTestKey,
  onToggleVisible,
}: Props) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>AI Provider</Typography>
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Claude authentication method
            </Typography>
            <ToggleButtonGroup
              value={settings.claude_auth_mode ?? "login"}
              exclusive
              onChange={(_, value) => { if (value) onUpdate("claude_auth_mode", value); }}
              size="small"
              fullWidth
            >
              <ToggleButton value="login">Login Flow</ToggleButton>
              <ToggleButton value="api_key">API Key</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {settings.claude_auth_mode === "api_key"
                ? "Authenticate with an Anthropic API key."
                : "Authenticate via Claude browser login."}
            </Typography>
          </Box>

          {settings.claude_auth_mode === "api_key" && (
            <ApiKeyRow
              label="Anthropic API Key"
              visibilityKey="anthropic"
              value={settings.anthropic_api_key ?? ""}
              placeholder="sk-ant-..."
              testing={testing === "anthropic"}
              onChange={(value) => onUpdate("anthropic_api_key", value)}
              onTest={() => onTestKey("anthropic")}
              onToggleVisible={() => onToggleVisible("anthropic")}
              visible={!!visible.anthropic}
            />
          )}

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Codex authentication method
            </Typography>
            <ToggleButtonGroup
              value={settings.codex_auth_mode ?? "login"}
              exclusive
              onChange={(_, value) => { if (value) onUpdate("codex_auth_mode", value); }}
              size="small"
              fullWidth
            >
              <ToggleButton value="login">Login Flow</ToggleButton>
              <ToggleButton value="api_key">API Key</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {settings.codex_auth_mode === "api_key"
                ? "Authenticate with an OpenAI-compatible API key for Codex."
                : "Authenticate through the Codex login flow."}
            </Typography>
          </Box>

          {settings.codex_auth_mode === "api_key" && (
            <ApiKeyRow
              label="Codex / OpenAI API Key"
              visibilityKey="openai"
              value={settings.openai_api_key ?? ""}
              placeholder="sk-..."
              testing={testing === "openai"}
              onChange={(value) => onUpdate("openai_api_key", value)}
              onTest={() => onTestKey("openai")}
              onToggleVisible={() => onToggleVisible("openai")}
              visible={!!visible.openai}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
