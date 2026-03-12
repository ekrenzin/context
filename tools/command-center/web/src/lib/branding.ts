import { createContext, useContext } from "react";

export interface PaletteConfig {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}

export interface BrandingConfig {
  name: string;
  subtitle: string;
  accentGradient: string;
  borderRadius: number;
  dark: PaletteConfig;
  light: PaletteConfig;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  name: "Context",
  subtitle: "Command Center",
  accentGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
  borderRadius: 10,
  dark: {
    primary: "#60a5fa",
    secondary: "#818cf8",
    success: "#4ade80",
    warning: "#fbbf24",
    error: "#f87171",
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
  },
  light: {
    primary: "#2563eb",
    secondary: "#4f46e5",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textSecondary: "#475569",
  },
};

declare global {
  interface Window {
    __CTX_BRANDING__?: BrandingConfig;
  }
}

export const BrandingContext = createContext<BrandingConfig>(DEFAULT_BRANDING);

export function useBranding(): BrandingConfig {
  return useContext(BrandingContext);
}

function mergeWithDefaults(partial: Partial<BrandingConfig>): BrandingConfig {
  return {
    ...DEFAULT_BRANDING,
    ...partial,
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
