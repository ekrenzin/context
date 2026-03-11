import { createTheme } from "@mui/material/styles";

const shared = {
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
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

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: "dark",
    primary: { main: "#d4af37" },
    secondary: { main: "#f0cf67" },
    success: { main: "#4caf50" },
    warning: { main: "#e6b44a" },
    error: { main: "#ef5350" },
    background: {
      default: "#050505",
      paper: "#111111",
    },
    text: {
      primary: "#f5e6b3",
      secondary: "#c9b27a",
    },
  },
});

export const lightTheme = createTheme({
  ...shared,
  palette: {
    mode: "light",
    primary: { main: "#8a6a0a" },
    secondary: { main: "#b7890d" },
    success: { main: "#2e7d32" },
    warning: { main: "#b7791f" },
    error: { main: "#c62828" },
    background: {
      default: "#f8f5ea",
      paper: "#fffdf7",
    },
    text: {
      primary: "#121212",
      secondary: "#3a3a3a",
    },
  },
});

export function getInitialMode(): "light" | "dark" {
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("theme");
  if (fromParam === "light" || fromParam === "dark") return fromParam;

  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}
