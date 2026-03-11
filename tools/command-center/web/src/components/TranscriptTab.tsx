import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Skeleton,
  Divider,
  Collapse,
  IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { ChatTurn } from "../lib/api";

const COLLAPSE_LINES = 2;
const LINE_HEIGHT_REM = 1.5;

function AgentBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const measureRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    setExpanded(false);
    if (measureRef.current) {
      const lineHeightPx = parseFloat(
        getComputedStyle(measureRef.current).lineHeight,
      );
      const clampHeight = lineHeightPx * COLLAPSE_LINES;
      setOverflows(measureRef.current.scrollHeight > clampHeight + 2);
    }
  }, [text]);

  return (
    <Box
      sx={{
        maxWidth: "85%",
        borderRadius: "12px 12px 12px 2px",
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.5, pt: 1, pb: overflows ? 0 : 1 }}>
        <Collapse
          in={expanded}
          collapsedSize={`${COLLAPSE_LINES * LINE_HEIGHT_REM}rem`}
        >
          <Typography
            ref={measureRef}
            variant="body2"
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: LINE_HEIGHT_REM,
              color: "text.primary",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              m: 0,
            }}
          >
            {text}
          </Typography>
        </Collapse>
      </Box>
      {overflows && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            px: 0.5,
            pb: 0.25,
            borderTop: expanded ? "1px solid" : "none",
            borderColor: "divider",
          }}
        >
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            sx={{ p: 0.25 }}
            aria-label={expanded ? "collapse" : "expand"}
          >
            {expanded ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

function TurnBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "text.disabled",
          mb: 0.25,
          px: 0.5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {isUser ? "User" : "Agent"}
      </Typography>
      {isUser ? (
        <Box
          sx={{
            maxWidth: "85%",
            px: 1.5,
            py: 1,
            borderRadius: "12px 12px 2px 12px",
            backgroundColor: "primary.dark",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              color: "primary.contrastText",
              fontSize: "0.85rem",
            }}
          >
            {turn.text}
          </Typography>
        </Box>
      ) : (
        <AgentBubble text={turn.text} />
      )}
    </Box>
  );
}

interface Props {
  turns: ChatTurn[];
  loading: boolean;
  totalCalls?: number;
}

export function TranscriptTab({ turns, loading, totalCalls }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [loading]);

  if (loading) {
    return (
      <Box ref={scrollRef} sx={{ py: 2, px: 0.5 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{
              mb: 1.5,
              height: 48,
              width: i % 2 === 0 ? "70%" : "55%",
              ml: i % 2 === 0 ? "auto" : 0,
            }}
          />
        ))}
      </Box>
    );
  }

  if (turns.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: 200,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          No transcript available for this session.
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={scrollRef} sx={{ py: 1 }}>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ display: "block", mb: 1.5 }}
      >
        {turns.length} turns &mdash; {totalCalls ?? 0} tool calls
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      {turns.map((turn, i) => (
        <TurnBubble key={i} turn={turn} />
      ))}
    </Box>
  );
}
