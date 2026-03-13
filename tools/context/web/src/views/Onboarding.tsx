import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Button, LinearProgress } from "@mui/material";
import { fetchBranding, type BrandingConfig } from "../lib/branding";
import { WelcomeStep } from "../components/onboarding/WelcomeStep";
import { AiProviderStep } from "../components/onboarding/AiProviderStep";
import { UIPreferencesStep } from "../components/onboarding/UIPreferencesStep";
import { PersonaStep } from "../components/onboarding/PersonaStep";
import { ProblemStep } from "../components/onboarding/ProblemStep";
import { LocalModelStep } from "../components/onboarding/LocalModelStep";
import { CliToolsStep } from "../components/onboarding/CliToolsStep";
import { RemoteAccessStep } from "../components/onboarding/RemoteAccessStep";
import { BuildingStep } from "../components/onboarding/BuildingStep";
import { FirstWin } from "../components/onboarding/FirstWin";

type Persona = "non-technical" | "power-user" | null;

interface SolutionResult {
  id: string;
  name: string;
  problem: string;
  status: string;
  components: unknown[];
}

const STEP_COUNT = 8;

const BUILD_MESSAGES = [
  { delay: 0, text: "Understanding your problem..." },
  { delay: 2000, text: "Designing the solution..." },
  { delay: 5000, text: "Building what you need..." },
  { delay: 8000, text: "Starting up..." },
];

function generateInsight(sol: SolutionResult): string {
  const count = sol.components?.length ?? 0;
  return `Your "${sol.name}" solution is live with ${count} component${count !== 1 ? "s" : ""}. `
    + "It will get smarter as you use it.";
}

export default function Onboarding({ onComplete, onBrandingChange }: { onComplete: () => void; onBrandingChange: (cfg: BrandingConfig) => void }) {
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona>(null);
  const [buildStatus, setBuildStatus] = useState("");
  const [solution, setSolution] = useState<SolutionResult | null>(null);
  const [insight, setInsight] = useState("");
  const [phase, setPhase] = useState<"steps" | "building" | "firstWin">("steps");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const selectedBranding = useRef<BrandingConfig | null>(null);

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const advance = useCallback(() => setStep((s) => s + 1), []);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  function handleBrandingPreview(config: BrandingConfig) {
    selectedBranding.current = config;
    window.__CTX_BRANDING__ = config;
    onBrandingChange(config);
  }

  async function handleUIComplete(config: BrandingConfig) {
    handleBrandingPreview(config);
    await fetchBranding();
    advance();
  }

  function handlePersonaSelect(p: "non-technical" | "power-user") {
    setPersona(p);
    advance();
  }

  async function handleSolve(problem: string, name: string) {
    setPhase("building");

    timersRef.current.forEach(clearTimeout);
    timersRef.current = BUILD_MESSAGES.map(({ delay, text }) =>
      setTimeout(() => setBuildStatus(text), delay),
    );

    try {
      const res = await fetch("/api/solutions/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, name }),
      });
      if (!res.ok) throw new Error(`Build failed: ${res.status}`);
      const sol: SolutionResult = await res.json();
      setSolution(sol);
      setInsight(generateInsight(sol));
      completeOnboarding();
      setPhase("firstWin");
    } catch {
      setBuildStatus("Something went wrong. Please try again.");
    }
  }

  function skipOnboarding() {
    if (selectedBranding.current) {
      fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedBranding.current),
      }).catch(() => { /* best-effort */ });
    }
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
        return <UIPreferencesStep onComplete={handleUIComplete} onBack={back} onPreview={handleBrandingPreview} />;
      case 3:
        return <LocalModelStep onComplete={advance} onBack={back} onSkip={advance} />;
      case 4:
        return <CliToolsStep onComplete={advance} onBack={back} onSkip={advance} />;
      case 5:
        return <RemoteAccessStep onComplete={advance} onBack={back} onSkip={advance} />;
      case 6:
        return <PersonaStep onSelect={handlePersonaSelect} onBack={back} />;
      case 7:
        return <ProblemStep persona={persona!} onSolve={handleSolve} onBack={back} />;
      default:
        return null;
    }
  }

  if (phase === "building") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BuildingStep status={buildStatus} />
      </Box>
    );
  }

  if (phase === "firstWin" && solution) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 3 }}>
        <FirstWin
          solution={solution}
          insight={insight}
          onExplore={() => onComplete()}
          onSolveAnother={() => onComplete()}
        />
      </Box>
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
