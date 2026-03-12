import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Stack, Button, Tooltip, Snackbar } from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { api } from "../lib/api";

interface LaunchButtonsProps {
  projectId: string;
}

export function LaunchButtons({ projectId }: LaunchButtonsProps) {
  const navigate = useNavigate();
  const [ides, setIdes] = useState<Array<{ name: string }>>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.listIdes().then(setIdes).catch(() => {});
  }, []);

  async function handleLaunch(ide: string) {
    try {
      const result = await api.launchIde(projectId, ide);
      if (result.method === "session" && result.sessionId) {
        navigate(`/terminal?session=${result.sessionId}&label=${encodeURIComponent(result.label)}`);
      } else {
        setToast(`Opened ${result.label}`);
      }
    } catch {
      setToast(`Failed to launch ${ide}`);
    }
  }

  if (ides.length === 0) return null;

  return (
    <>
      <Stack direction="row" spacing={0.5}>
        {ides.map((ide) => (
          <Tooltip key={ide.name} title={`Open in ${ide.name}`}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RocketLaunchIcon />}
              onClick={() => handleLaunch(ide.name)}
            >
              {ide.name}
            </Button>
          </Tooltip>
        ))}
      </Stack>
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
      />
    </>
  );
}
