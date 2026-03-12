import { Component, type ReactNode } from "react";
import { Box, Typography, Button, Stack, Paper } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Catches render crashes from broken hot-reloads and shows a recovery screen.
 * Automatically retries every 3s in case HMR pushes a fix while the user waits.
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // Start auto-retry — HMR may push a fix while we're showing the error screen
    if (!this.retryTimer) {
      this.retryTimer = setInterval(() => {
        this.setState((prev) => {
          if (prev.retryCount >= 10) {
            // Stop retrying after 30s
            if (this.retryTimer) clearInterval(this.retryTimer);
            this.retryTimer = null;
            return prev;
          }
          return { hasError: false, error: null, retryCount: prev.retryCount + 1 };
        });
      }, 3000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            bgcolor: "background.default",
            p: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 480,
              p: 4,
              textAlign: "center",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <BuildCircleIcon sx={{ fontSize: 56, color: "warning.main", mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              View crashed
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              An agent is probably editing code right now. The fix will land via hot reload automatically.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
              Auto-retrying{this.state.retryCount > 0 ? ` (attempt ${this.state.retryCount}/10)` : "..."}
            </Typography>

            {this.state.error && (
              <Paper
                variant="outlined"
                sx={{
                  bgcolor: "grey.900",
                  color: "error.light",
                  p: 1.5,
                  mb: 3,
                  maxHeight: 120,
                  overflow: "auto",
                  textAlign: "left",
                }}
              >
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", m: 0 }}
                >
                  {this.state.error.message}
                </Typography>
              </Paper>
            )}

            <Stack direction="row" spacing={1} justifyContent="center">
              <Button variant="outlined" onClick={this.handleRetry}>
                Retry Now
              </Button>
              <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.handleReload}>
                Full Reload
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
