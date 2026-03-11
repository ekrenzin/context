import {
  TableRow,
  TableCell,
  Typography,
  Box,
  Collapse,
} from "@mui/material";
import { VerdictChip } from "./VerdictChip";
import { AnalysisPanel } from "./AnalysisPanel";
import type { SessionRecord, SessionAnalysis } from "../lib/api";

interface SessionRowProps {
  record: SessionRecord;
  expanded: boolean;
  analysis: SessionAnalysis | null;
  onToggle: () => void;
}

export function SessionRow({ record, expanded, analysis, onToggle }: SessionRowProps) {
  const name =
    record.title ||
    (record.firstQuery
      ? record.firstQuery.slice(0, 80) + (record.firstQuery.length > 80 ? "..." : "")
      : record.chatId.slice(0, 8));

  const time = record.timestamp
    ? new Date(record.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : record.date;

  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{ cursor: "pointer", "& td": { borderBottom: expanded ? 0 : undefined } }}
      >
        <TableCell sx={{ width: 100 }}>
          <VerdictChip verdict={record.verdict} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={500}>
            {name}
          </Typography>
          {record.summary && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {record.summary}
            </Typography>
          )}
        </TableCell>
        <TableCell align="center" sx={{ width: 60 }}>
          <Typography variant="body2">{record.userTurns}</Typography>
        </TableCell>
        <TableCell align="center" sx={{ width: 60 }}>
          <Typography variant="body2">{record.totalCalls}</Typography>
        </TableCell>
        <TableCell sx={{ width: 120 }}>
          <Typography variant="caption" color="text.secondary">
            {time}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, borderBottom: expanded ? undefined : 0, overflow: "hidden" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, maxWidth: "100%", overflow: "hidden" }}>
              <AnalysisPanel record={record} analysis={analysis} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
