import { useState } from "react";
import { Fab, Badge, keyframes } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import { MediaModal } from "./MediaModal";
import type { PreviewEntry } from "../hooks/usePreviewEntries";

const shake = keyframes`
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(-12deg); }
  30% { transform: rotate(10deg); }
  45% { transform: rotate(-8deg); }
  60% { transform: rotate(6deg); }
  75% { transform: rotate(-3deg); }
`;

interface Props {
  entries: PreviewEntry[];
  unseenCount: number;
  shaking: boolean;
  onOpen: () => void;
}

export function MediaFab({ entries, unseenCount, shaking, onOpen }: Props) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  function handleClick() {
    setOpen(true);
    onOpen();
  }

  return (
    <>
      <Fab
        color="primary"
        onClick={handleClick}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1200,
          animation: shaking ? `${shake} 0.6s ease-in-out` : "none",
        }}
      >
        <Badge
          badgeContent={unseenCount}
          color="error"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              top: -4,
              right: -4,
            },
          }}
        >
          <CollectionsIcon />
        </Badge>
      </Fab>

      <MediaModal
        entries={entries}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
