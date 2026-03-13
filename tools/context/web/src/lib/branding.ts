import { createContext, useContext } from "react";

export interface PaletteConfig {
  primary: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  highlight: string;
  accent: string;
  text: string;
  textSecondary: string;
  textMuted: string;
}

export type ElevationLevel = "flat" | "subtle" | "raised";

export interface BrandingConfig {
  name: string;
  subtitle: string;
  accentGradient: string;
  surfaceGradient?: string;
  useGradient: boolean;
  borderRadius: number;
  elevation: ElevationLevel;
  dark: PaletteConfig;
  light: PaletteConfig;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  name: "Context",
  subtitle: "Command Center",
  accentGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
  useGradient: true,
  borderRadius: 10,
  elevation: "subtle",
  dark: {
    primary: "#60a5fa",
    secondary: "#818cf8",
    tertiary: "#a78bfa",
    success: "#4ade80",
    warning: "#fbbf24",
    error: "#f87171",
    background: "#0f172a",
    surface: "#1e293b",
    surfaceAlt: "#273548",
    border: "#334155",
    highlight: "#1e3a5f",
    accent: "#3b82f6",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
  },
  light: {
    primary: "#2563eb",
    secondary: "#4f46e5",
    tertiary: "#7c3aed",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    border: "#e2e8f0",
    highlight: "#eff6ff",
    accent: "#3b82f6",
    text: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
  },
};

declare global {
  interface Window {
    __CTX_BRANDING__?: BrandingConfig;
  }
}

export const BrandingContext = createContext<BrandingConfig>(DEFAULT_BRANDING);

type BrandingSetter = (cfg: BrandingConfig) => void;
export const SetBrandingContext = createContext<BrandingSetter>(() => {});

export function useBranding(): BrandingConfig {
  return useContext(BrandingContext);
}

export function useSetBranding(): BrandingSetter {
  return useContext(SetBrandingContext);
}

export function resolveAccent(cfg: BrandingConfig, mode: "dark" | "light"): string {
  if (cfg.useGradient) return cfg.accentGradient;
  const p = mode === "dark" ? cfg.dark : cfg.light;
  return p.primary;
}

export function resolveSurfaceGradient(cfg: BrandingConfig, mode: "dark" | "light"): string | undefined {
  if (!cfg.useGradient) return undefined;
  if (cfg.surfaceGradient) return cfg.surfaceGradient;
  const p = mode === "dark" ? cfg.dark : cfg.light;
  return `linear-gradient(180deg, ${p.background} 0%, ${p.surfaceAlt} 100%)`;
}

function mergeWithDefaults(partial: Partial<BrandingConfig>): BrandingConfig {
  return {
    ...DEFAULT_BRANDING,
    ...partial,
    useGradient: partial.useGradient ?? DEFAULT_BRANDING.useGradient,
    elevation: partial.elevation ?? DEFAULT_BRANDING.elevation,
    dark: { ...DEFAULT_BRANDING.dark, ...(partial.dark ?? {}) },
    light: { ...DEFAULT_BRANDING.light, ...(partial.light ?? {}) },
  };
}

export async function fetchBranding(): Promise<BrandingConfig> {
  if (window.__CTX_BRANDING__) return mergeWithDefaults(window.__CTX_BRANDING__);

  try {
    const res = await fetch("/api/branding");
    if (!res.ok) return DEFAULT_BRANDING;
    const data = await res.json();
    const merged = mergeWithDefaults(data);
    window.__CTX_BRANDING__ = merged;
    return merged;
  } catch {
    return DEFAULT_BRANDING;
  }
}
