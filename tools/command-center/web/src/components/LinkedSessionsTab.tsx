import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import type { SessionMapNode } from "../lib/api";
import { VERDICT_HEX } from "./SessionGraph3D";

interface Props {
  neighbors: SessionMapNode[];
  onNavigate: (node: SessionMapNode) => void;
}

export function LinkedSessionsTab({ neighbors, onNavigate }: Props) {
  if (neighbors.length === 0) {
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
          No linked sessions found.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: "100%" }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Session</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Verdict</TableCell>
            <TableCell align="right">Tool Calls</TableCell>
            <TableCell>Repos</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {neighbors.map((n) => (
            <TableRow
              key={n.id}
              hover
              onClick={() => onNavigate(n)}
              sx={{ cursor: "pointer" }}
            >
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
                  {n.title || n.id.slice(0, 8)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {n.date}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={n.verdict}
                  sx={{
                    backgroundColor: VERDICT_HEX[n.verdict] ?? "#888",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.68rem",
                    height: 20,
                  }}
                />
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption">{n.totalCalls}</Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: 160 }}
                >
                  {n.repos.join(", ") || "--"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
