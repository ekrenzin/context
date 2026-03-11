import { useState, useRef } from "react";
import {
  Chip,
  Popover,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import GitHubIcon from "@mui/icons-material/GitHub";
import CloudIcon from "@mui/icons-material/Cloud";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import type { IdentitySnapshot, IdentityProvider } from "../lib/api";

interface Props {
  socketConnected: boolean;
  identities: IdentitySnapshot;
}

function ProviderIcon({ provider }: { provider: IdentityProvider["provider"] }) {
  if (provider === "github") return <GitHubIcon sx={{ fontSize: 16 }} />;
  if (provider === "aws") return <CloudIcon sx={{ fontSize: 16 }} />;
  return <PersonIcon sx={{ fontSize: 16 }} />;
}

function StatusIcon({ status }: { status: IdentityProvider["status"] }) {
  if (status === "connected") return <CheckCircleOutlineIcon sx={{ fontSize: 14 }} color="success" />;
  if (status === "disconnected") return <ErrorOutlineIcon sx={{ fontSize: 14 }} color="error" />;
  return <HelpOutlineIcon sx={{ fontSize: 14 }} color="disabled" />;
}

function IdentityRow({ identity }: { identity: IdentityProvider }) {
  const label = identity.username ?? identity.displayName ?? identity.accountId ?? "--";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 0.75,
        px: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <ProviderIcon provider={identity.provider} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} sx={{ textTransform: "capitalize" }}>
            {identity.provider}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {identity.status === "connected" ? label : (identity.detail ?? identity.status)}
          </Typography>
        </Box>
      </Box>
      <StatusIcon status={identity.status} />
    </Box>
  );
}

export function StatusDropdown({ socketConnected, identities }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const providers = [identities.github, identities.cursor, identities.aws];
  const connectedCount = providers.filter((p) => p.status === "connected").length;
  const allGood = connectedCount === 3 && socketConnected;

  const chipColor: "success" | "warning" | "error" | "default" =
    allGood ? "success"
      : connectedCount > 0 ? "warning"
        : "error";

  return (
    <>
      <Chip
        ref={anchorRef}
        size="small"
        variant="outlined"
        color={chipColor}
        onClick={() => setOpen((prev) => !prev)}
        icon={
          <FiberManualRecordIcon
            sx={{
              fontSize: "10px !important",
              color: socketConnected ? "success.main" : "error.main",
            }}
          />
        }
        label={`${connectedCount}/3`}
        sx={{ height: 22, fontSize: 11, cursor: "pointer" }}
      />

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 280, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Status
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
            <FiberManualRecordIcon
              sx={{ fontSize: 10, color: socketConnected ? "success.main" : "error.main" }}
            />
            <Typography variant="caption" color="text.secondary">
              Bridge {socketConnected ? "connected" : "disconnected"}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {providers.map((p) => (
          <IdentityRow key={p.provider} identity={p} />
        ))}
      </Popover>
    </>
  );
}
