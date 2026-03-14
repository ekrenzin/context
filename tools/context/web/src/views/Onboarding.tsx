import { useState, useCallback } from "react";
import { Box, Button, LinearProgress } from "@mui/material";
import type { BrandingConfig } from "../lib/branding";
import { WelcomeStep } from "../components/onboarding/WelcomeStep";
import { AiProviderStep } from "../components/onboarding/AiProviderStep";
import { PersonaStep } from "../components/onboarding/PersonaStep";
import { ProblemStep } from "../components/onboarding/ProblemStep";
import { LocalModelStep } from "../components/onboarding/LocalModelStep";
import { CliToolsStep } from "../components/onboarding/CliToolsStep";
import { RemoteAccessStep } from "../components/onboarding/RemoteAccessStep";
import { ProposingStep } from "../components/onboarding/ProposingStep";

type Persona = "non-technical" | "power-user" | null;
type CliTool = "claude" | "codex";

const TOOL_LABELS: Record<CliTool, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

const STEP_COUNT = 7;

export interface PendingSession {
  id: string;
  label: string;
}

export default function Onboarding({ onComplete, onBrandingChange }: { onComplete: (session?: PendingSession) => void; onBrandingChange: (cfg: BrandingConfig) => void }) {
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona>(null);
  const [cliTools, setCliTools] = useState({ claude: false, codex: false });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<CliTool>("claude");
  const [phase, setPhase] = useState<"steps" | "proposing">("steps");
  const advance = useCallback(() => setStep((s) => s + 1), []);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  function handlePersonaSelect(p: "non-technical" | "power-user") {
    setPersona(p);
    advance();
  }

  function handleToolsDetected(tools: { claude: boolean; codex: boolean }) {
    setCliTools(tools);
  }

  async function handlePropose(problem: string, name: string, tool: CliTool) {
    setSelectedTool(tool);
    setPhase("proposing");

    try {
      const res = await fetch("/api/onboarding/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, name, tool }),
      });
      if (!res.ok) throw new Error(`Propose failed: ${res.status}`);
      const data: { sessionId: string; slug: string } = await res.json();
      setSessionId(data.sessionId);
    } catch {
      setPhase("steps");
    }
  }

  function handleTransitionToDrawer() {
    completeOnboarding();
    onComplete(sessionId ? { id: sessionId, label: TOOL_LABELS[selectedTool] } : undefined);
  }

  function skipOnboarding() {
    completeOnboarding();
    onComplete();
  }

  function completeOnboarding() {
    fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    }).catch(() => { /* best-effort */ });
  }

  function renderStep() {
    switch (step) {
      case 0:
        return <WelcomeStep onBegin={advance} />;
      case 1:
        return <AiProviderStep onComplete={advance} onBack={back} />;
      case 2:
        return <LocalModelStep onComplete={advance} onBack={back} onSkip={advance} />;
      case 3:
        return <CliToolsStep onComplete={advance} onBack={back} onSkip={advance} onToolsDetected={handleToolsDetected} />;
      case 4:
        return <RemoteAccessStep onComplete={advance} onBack={back} onSkip={advance} />;
      case 5:
        return <PersonaStep onSelect={handlePersonaSelect} onBack={back} />;
      case 6:
        return (
          <ProblemStep
            persona={persona!}
            availableTools={cliTools}
            onPropose={handlePropose}
            onBack={back}
          />
        );
      default:
        return null;
    }
  }

  if (phase === "proposing" && sessionId) {
    return (
      <ProposingStep
        sessionId={sessionId}
        tool={selectedTool}
        onTransition={handleTransitionToDrawer}
      />
    );
  }

  const progress = step > 0 ? (step / STEP_COUNT) * 100 : 0;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Button
        size="small"
        onClick={skipOnboarding}
        sx={{
          position: "fixed",
          top: 12,
          right: 16,
          zIndex: 1400,
          textTransform: "none",
          opacity: 0.6,
          "&:hover": { opacity: 1 },
        }}
      >
        Skip
      </Button>
      {step > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            height: 3,
            "& .MuiLinearProgress-bar": {
              transition: "transform 0.4s ease",
            },
          }}
        />
      )}

      <Box
        key={step}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          animation: "story-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {renderStep()}
      </Box>
    </Box>
  );
}
