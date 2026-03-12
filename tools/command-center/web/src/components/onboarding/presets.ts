import type { BrandingConfig } from "../../lib/branding";

export interface MoodPreset {
  id: string;
  label: string;
  description: string;
  config: BrandingConfig;
}

const BASE = { name: "Context", subtitle: "Command Center" };

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep dark blues, calm and focused",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
      borderRadius: 10,
      dark: {
        primary: "#60a5fa", secondary: "#818cf8", success: "#4ade80",
        warning: "#fbbf24", error: "#f87171", background: "#0f172a",
        surface: "#1e293b", text: "#f1f5f9", textSecondary: "#94a3b8",
      },
      light: {
        primary: "#2563eb", secondary: "#4f46e5", success: "#16a34a",
        warning: "#d97706", error: "#dc2626", background: "#f8fafc",
        surface: "#ffffff", text: "#0f172a", textSecondary: "#475569",
      },
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "Earthy greens, grounded and natural",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #16a34a, #84cc16)",
      borderRadius: 12,
      dark: {
        primary: "#4ade80", secondary: "#a3e635", success: "#22c55e",
        warning: "#facc15", error: "#f87171", background: "#0c1a0f",
        surface: "#1a2e1d", text: "#ecfdf5", textSecondary: "#86efac",
      },
      light: {
        primary: "#15803d", secondary: "#4d7c0f", success: "#16a34a",
        warning: "#ca8a04", error: "#dc2626", background: "#f0fdf4",
        surface: "#ffffff", text: "#14532d", textSecondary: "#166534",
      },
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm amber tones, energetic",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
      borderRadius: 8,
      dark: {
        primary: "#fbbf24", secondary: "#fb923c", success: "#4ade80",
        warning: "#f59e0b", error: "#ef4444", background: "#1c1208",
        surface: "#2d1f0e", text: "#fef3c7", textSecondary: "#fcd34d",
      },
      light: {
        primary: "#d97706", secondary: "#ea580c", success: "#16a34a",
        warning: "#b45309", error: "#dc2626", background: "#fffbeb",
        surface: "#ffffff", text: "#451a03", textSecondary: "#92400e",
      },
    },
  },
  {
    id: "neon",
    label: "Neon",
    description: "Vibrant purple and pink, bold",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #a855f7, #ec4899)",
      borderRadius: 14,
      dark: {
        primary: "#c084fc", secondary: "#f472b6", success: "#4ade80",
        warning: "#fbbf24", error: "#fb7185", background: "#120b20",
        surface: "#1e1533", text: "#f5f3ff", textSecondary: "#c4b5fd",
      },
      light: {
        primary: "#9333ea", secondary: "#db2777", success: "#16a34a",
        warning: "#d97706", error: "#e11d48", background: "#fdf4ff",
        surface: "#ffffff", text: "#3b0764", textSecondary: "#7e22ce",
      },
    },
  },
  {
    id: "mono",
    label: "Mono",
    description: "Clean grayscale, no distraction",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #6b7280, #374151)",
      borderRadius: 6,
      dark: {
        primary: "#d1d5db", secondary: "#9ca3af", success: "#6ee7b7",
        warning: "#fcd34d", error: "#fca5a5", background: "#111111",
        surface: "#1a1a1a", text: "#f3f4f6", textSecondary: "#9ca3af",
      },
      light: {
        primary: "#374151", secondary: "#6b7280", success: "#059669",
        warning: "#d97706", error: "#dc2626", background: "#fafafa",
        surface: "#ffffff", text: "#111827", textSecondary: "#6b7280",
      },
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Teal and cyan, airy and open",
    config: {
      ...BASE,
      accentGradient: "linear-gradient(135deg, #0891b2, #06b6d4)",
      borderRadius: 12,
      dark: {
        primary: "#22d3ee", secondary: "#2dd4bf", success: "#4ade80",
        warning: "#fbbf24", error: "#f87171", background: "#0b1a1e",
        surface: "#132f36", text: "#ecfeff", textSecondary: "#67e8f9",
      },
      light: {
        primary: "#0891b2", secondary: "#0d9488", success: "#16a34a",
        warning: "#d97706", error: "#dc2626", background: "#ecfeff",
        surface: "#ffffff", text: "#164e63", textSecondary: "#0e7490",
      },
    },
  },
];
