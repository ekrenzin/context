import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button, Paper, Stack } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface TourStep {
  target: string;
  title: string;
  what: string;
  why: string;
  /** Route to navigate to before showing this step. */
  navigateTo?: string;
  /** Called when transitioning TO this step (e.g. close/open drawers). */
  onEnter?: string;
}

const STEPS: TourStep[] = [
  {
    target: "tour-terminal",
    title: "Terminal Drawer",
    what: "Agent sessions, shells, and CLI tools all live here. The proposal you just kicked off is running in this drawer right now.",
    why: "One place for every terminal session -- they persist across refreshes and can be opened from anywhere in the app.",
  },
  {
    target: "tour-workspace",
    title: "Workspace",
    what: "Projects, solutions, and proposals all in one place -- your command center for ongoing work.",
    why: "Everything you're building lives here. No bouncing between pages.",
    navigateTo: "/workspace",
    onEnter: "closeTerminal",
  },
  {
    target: "tour-proposals-tab",
    title: "Proposals",
    what: "When your proposal finishes, it will appear here. Proposals break problems into numbered tasks that agents can pick up.",
    why: "This is how Context turns ideas into buildable plans -- from problem statement to implementation tasks.",
    navigateTo: "/workspace?tab=proposals",
  },
  {
    target: "tour-dashboard",
    title: "Dashboard",
    what: "Analytics, session logs, skill graphs, and system status at a glance.",
    why: "Review past sessions, monitor system health, and spot issues you'd miss on your own.",
  },
  {
    target: "tour-settings",
    title: "Settings",
    what: "Configure AI providers, integrations, appearance, and workspace preferences.",
    why: "Every team and workflow is different -- this is where you make the workspace truly yours.",
  },
];

const SPOTLIGHT_PAD = 6;
const CARD_W = 340;
const CARD_GAP = 20;
const VIEWPORT_PAD = 12;

type Placement = "right" | "left" | "top" | "bottom";

function computePlacement(
  r: DOMRect,
  cardH: number,
): { placement: Placement; top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceRight = vw - r.right - SPOTLIGHT_PAD;
  const spaceLeft = r.left - SPOTLIGHT_PAD;
  const spaceTop = r.top - SPOTLIGHT_PAD;
  const neededH = CARD_W + CARD_GAP + VIEWPORT_PAD;
  const neededV = cardH + CARD_GAP + VIEWPORT_PAD;

  let placement: Placement = "right";
  if (spaceRight >= neededH) {
    placement = "right";
  } else if (spaceLeft >= neededH) {
    placement = "left";
  } else if (spaceTop >= neededV) {
    placement = "top";
  } else {
    placement = "bottom";
  }

  let top: number;
  let left: number;

  if (placement === "right") {
    left = r.right + SPOTLIGHT_PAD + CARD_GAP;
    top = r.top - SPOTLIGHT_PAD;
  } else if (placement === "left") {
    left = r.left - SPOTLIGHT_PAD - CARD_GAP - CARD_W;
    top = r.top - SPOTLIGHT_PAD;
  } else if (placement === "top") {
    left = r.left + r.width / 2 - CARD_W / 2;
    top = r.top - SPOTLIGHT_PAD - CARD_GAP - cardH;
  } else {
    left = r.left + r.width / 2 - CARD_W / 2;
    top = r.bottom + SPOTLIGHT_PAD + CARD_GAP;
  }

  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - CARD_W - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD - cardH));

  return { placement, top, left };
}

function arrowSx(placement: Placement) {
  const base = {
    position: "absolute" as const,
    width: 0,
    height: 0,
  };
  const transparent = "8px solid transparent";
  if (placement === "right") {
    return { ...base, left: -8, top: 22, borderTop: transparent, borderBottom: transparent, borderRight: "8px solid", borderRightColor: "background.paper" };
  }
  if (placement === "left") {
    return { ...base, right: -8, top: 22, borderTop: transparent, borderBottom: transparent, borderLeft: "8px solid", borderLeftColor: "background.paper" };
  }
  if (placement === "top") {
    return { ...base, bottom: -8, left: "calc(50% - 8px)", borderLeft: transparent, borderRight: transparent, borderTop: "8px solid", borderTopColor: "background.paper" };
  }
  return { ...base, top: -8, left: "calc(50% - 8px)", borderLeft: transparent, borderRight: transparent, borderBottom: "8px solid", borderBottomColor: "background.paper" };
}

interface Props {
  active: boolean;
  onComplete: () => void;
  onCloseTerminal?: () => void;
}

export function GuidedTour({ active, onComplete, onCloseTerminal }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(280);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const current = STEPS[step];

  // Navigate and fire onEnter when step changes
  useEffect(() => {
    if (!active || !current) return;
    if (current.onEnter === "closeTerminal") {
      onCloseTerminal?.();
    }
    if (current.navigateTo) {
      navigate(current.navigateTo);
    }
  }, [step, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure target element position
  useEffect(() => {
    if (!active || !current) return;
    // Small delay to let navigation + render settle
    const delay = current.navigateTo ? 300 : 0;
    let cancelled = false;
    const timeout = setTimeout(() => {
      function measure() {
        if (cancelled) return;
        const el = document.querySelector(`[data-tour="${current.target}"]`);
        if (el) {
          setRect(el.getBoundingClientRect());
        } else {
          // Element not yet rendered, retry
          requestAnimationFrame(measure);
        }
      }
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }, delay);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [active, step, current]);

  useEffect(() => {
    if (cardRef.current) {
      setCardH(cardRef.current.getBoundingClientRect().height);
    }
  });

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      onComplete();
    } else {
      setRect(null);
      setStep((s) => s + 1);
    }
  }, [step, onComplete]);

  if (!active || !current || !rect) return null;

  const { placement, top: cardTop, left: cardLeft } = computePlacement(rect, cardH);

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 1500 }}>
      {/* Click-away backdrop */}
      <Box sx={{ position: "absolute", inset: 0 }} />

      {/* Spotlight cutout */}
      <Box
        sx={{
          position: "absolute",
          top: rect.top - SPOTLIGHT_PAD,
          left: rect.left - SPOTLIGHT_PAD,
          width: rect.width + SPOTLIGHT_PAD * 2,
          height: rect.height + SPOTLIGHT_PAD * 2,
          borderRadius: 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          pointerEvents: "none",
          transition: "all 0.3s ease",
        }}
      />

      {/* Popover card */}
      <Paper
        ref={cardRef}
        elevation={8}
        sx={{
          position: "absolute",
          top: cardTop,
          left: cardLeft,
          width: CARD_W,
          p: 3,
          transition: "top 0.3s ease, left 0.3s ease",
        }}
      >
        {/* Arrow */}
        <Box sx={arrowSx(placement)} />

        <Typography variant="overline" color="text.secondary">
          {step + 1} of {STEPS.length}
        </Typography>

        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {current.title}
        </Typography>

        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {current.what}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2.5, fontStyle: "italic" }}
        >
          {current.why}
        </Typography>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            size="small"
            onClick={onComplete}
            sx={{ textTransform: "none", opacity: 0.7 }}
          >
            Skip tour
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={next}
            endIcon={step < STEPS.length - 1 ? <ArrowForwardIcon /> : undefined}
            disableElevation
            sx={{ textTransform: "none" }}
          >
            {step < STEPS.length - 1 ? "Next" : "Get started"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
