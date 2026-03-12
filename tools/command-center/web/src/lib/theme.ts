import { createTheme, type Theme } from "@mui/material/styles";
import type { BrandingConfig, PaletteConfig } from "./branding";

const shared = {
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { variant: "outlined" as const },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
  },
};

function buildMode(mode: "dark" | "light", p: PaletteConfig, borderRadius: number): Theme {
  return createTheme({
    ...shared,
    shape: { borderRadius },
    palette: {
      mode,
      primary: { main: p.primary },
      secondary: { main: p.secondary },
      success: { main: p.success },
      warning: { main: p.warning },
      error: { main: p.error },
      background: { default: p.background, paper: p.surface },
      text: { primary: p.text, secondary: p.textSecondary },
    },
  });
}

export function buildThemes(cfg: BrandingConfig): { dark: Theme; light: Theme } {
  return {
    dark: buildMode("dark", cfg.dark, cfg.borderRadius),
    light: buildMode("light", cfg.light, cfg.borderRadius),
  };
}

export function getInitialMode(): "light" | "dark" {
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("theme");
  if (fromParam === "light" || fromParam === "dark") return fromParam;

  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}
