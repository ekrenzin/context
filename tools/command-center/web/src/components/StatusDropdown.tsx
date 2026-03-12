import { useState, useRef, useEffect } from "react";
import {
  Chip,
  Popover,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export interface ServiceCheck {
  id: string;
  label: string;
  status: "ok" | "degraded" | "down";
  detail?: string;
}

function StatusIcon({ status }: { status: ServiceCheck["status"] }) {
  if (status === "ok") return <CheckCircleOutlineIcon sx={{ fontSize: 14 }} color="success" />;
  if (status === "degraded") return <WarningAmberIcon sx={{ fontSize: 14 }} color="warning" />;
  return <ErrorOutlineIcon sx={{ fontSize: 14 }} color="error" />;
}

function ServiceRow({ service }: { service: ServiceCheck }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.75, px: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500}>{service.label}</Typography>
        {service.detail && (
          <Typography variant="caption" color="text.secondary" noWrap>{service.detail}</Typography>
        )}
      </Box>
      <StatusIcon status={service.status} />
    </Box>
  );
}

export function StatusDropdown() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceCheck[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((h) => { if (!cancelled && Array.isArray(h.services)) setServices(h.services); })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const downCount = services.filter((s) => s.status === "down").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;

  const chipColor: "success" | "warning" | "error" =
    downCount > 0 ? "error" : degradedCount > 0 ? "warning" : "success";

  const chipLabel = downCount > 0
    ? `${downCount} down`
    : degradedCount > 0
      ? `${degradedCount} warn`
      : "All OK";

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
            sx={{ fontSize: "10px !important", color: `${chipColor}.main` }}
          />
        }
        label={chipLabel}
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
          <Typography variant="subtitle2" fontWeight={600}>Services</Typography>
        </Box>
        <Divider />
        {services.map((s) => (
          <ServiceRow key={s.id} service={s} />
        ))}
      </Popover>
    </>
  );
}
