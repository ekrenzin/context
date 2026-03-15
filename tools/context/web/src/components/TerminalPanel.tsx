import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useTerminal, type SessionState } from "../hooks/useTerminal";

export type { SessionState };

interface Props {
  sessionId: string;
  active?: boolean;
  suspendResize?: boolean;
  onExit?: (code: number) => void;
  onStateChange?: (state: SessionState) => void;
}

export function TerminalPanel({ sessionId, active = true, suspendResize, onExit, onStateChange }: Props) {
  const theme = useTheme();
  const { containerRef, focused, setFocused, dragOver } = useTerminal({
    sessionId,
    active,
    suspendResize,
    onExit,
    onStateChange,
  });

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: focused ? 1 : 0.8,
        filter: focused ? "none" : "saturate(0.7)",
        transition: "opacity 200ms ease, filter 200ms ease, transform 200ms ease",
        "&:hover": !focused ? {
          opacity: 0.9,
          filter: "saturate(0.85)",
        } : {},
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          "& .xterm": { height: "100%", p: 0.5 },
        }}
      />
      {!focused && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            cursor: "pointer",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFocused(true);
          }}
        />
      )}
      {dragOver && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: 1,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Box
            component="span"
            sx={{
              color: "primary.main",
              fontSize: 14,
              fontFamily: "monospace",
              fontWeight: 600,
              px: 2,
              py: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: 1,
            }}
          >
            Drop to paste path
          </Box>
        </Box>
      )}
    </Box>
  );
}
