import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  Tab,
  Tabs,
  Badge,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  api,
  type SessionMapNode,
  type SessionAnalysis,
  type SessionRecord,
  type ChatTurn,
} from "../lib/api";
import { VERDICT_HEX } from "./SessionGraph3D";
import { AnalysisPanel } from "./AnalysisPanel";
import { LinkedSessionsTab } from "./LinkedSessionsTab";
import { TranscriptTab } from "./TranscriptTab";

interface Props {
  node: SessionMapNode | null;
  neighbors: SessionMapNode[];
  onClose: () => void;
  onNavigate: (node: SessionMapNode) => void;
}

const TAB_ANALYSIS = 0;
const TAB_LINKED = 1;
const TAB_TRANSCRIPT = 2;

export function ChatModal({ node, neighbors, onClose, onNavigate }: Props) {
  const [tab, setTab] = useState(TAB_ANALYSIS);
  const [record, setRecord] = useState<SessionRecord | null>(null);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  useEffect(() => {
    if (!node) return;
    setTab(TAB_ANALYSIS);
    setRecord(null);
    setAnalysis(null);
    setTurns([]);

    setLoadingAnalysis(true);
    api
      .sessionDetail(node.id)
      .then(({ record: r, analysis: a }) => {
        setRecord(r);
        setAnalysis(a);
      })
      .catch(() => {})
      .finally(() => setLoadingAnalysis(false));

    setLoadingTranscript(true);
    api
      .sessionTranscript(node.id)
      .then(({ turns: t }) => setTurns(t))
      .catch(() => setTurns([]))
      .finally(() => setLoadingTranscript(false));
  }, [node?.id]);

  const verdictColor = node ? (VERDICT_HEX[node.verdict] ?? "#888") : "#888";

  return (
    <Dialog
      open={node !== null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: "85vh", display: "flex", flexDirection: "column" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          pb: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {node?.title ?? "Session"}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.5 }}>
            {node && (
              <Chip
                size="small"
                label={node.verdict}
                sx={{
                  backgroundColor: verdictColor,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.68rem",
                  height: 18,
                }}
              />
            )}
            {node && (
              <Chip
                size="small"
                label={node.date}
                variant="outlined"
                sx={{ fontSize: "0.68rem", height: 18 }}
              />
            )}
            {node && node.repos.length > 0 && (
              <Chip
                size="small"
                label={node.repos.join(", ")}
                variant="outlined"
                sx={{ fontSize: "0.68rem", height: 18 }}
              />
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 36 }}
        >
          <Tab label="Analysis" sx={{ minHeight: 36, py: 0 }} />
          <Tab
            label={
              <Badge
                badgeContent={neighbors.length}
                color="primary"
                max={99}
                sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16 } }}
              >
                <span>Linked Sessions</span>
              </Badge>
            }
            sx={{ minHeight: 36, py: 0 }}
          />
          <Tab label="Transcript" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, overflowY: "auto", py: 2, px: 2.5 }}>
        {tab === TAB_ANALYSIS && (
          <AnalysisPanel
            record={record ?? { chatId: node?.id ?? "", title: node?.title ?? "", summary: "", verdict: node?.verdict ?? "", firstQuery: "", date: node?.date ?? "", timestamp: "", fileBytes: 0, userTurns: node?.userTurns ?? 0, assistantTurns: 0, totalCalls: node?.totalCalls ?? 0, tools: {}, skills: node?.skills ?? [], skillCounts: {}, subagentTypes: {}, planMode: false, thinkingBlocks: 0, responseCharsTotal: 0, responseCharsAvg: 0, responseCharsMax: 0 }}
            analysis={analysis}
            loading={loadingAnalysis}
          />
        )}
        {tab === TAB_LINKED && (
          <LinkedSessionsTab
            neighbors={neighbors}
            onNavigate={onNavigate}
          />
        )}
        {tab === TAB_TRANSCRIPT && (
          <TranscriptTab
            turns={turns}
            loading={loadingTranscript}
            totalCalls={node?.totalCalls}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
