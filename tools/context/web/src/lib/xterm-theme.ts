import { alpha, darken, lighten, type Theme } from "@mui/material/styles";

export function createTerminalTheme(theme: Theme) {
  const { palette } = theme;
  const surface = palette.background.paper;
  const isDark = palette.mode === "dark";

  return {
    background: surface,
    foreground: palette.text.primary,
    cursor: palette.primary.main,
    cursorAccent: surface,
    selectionBackground: alpha(palette.primary.main, isDark ? 0.3 : 0.2),
    selectionForeground: palette.text.primary,
    black: isDark ? darken(surface, 0.32) : darken(surface, 0.22),
    red: palette.error.main,
    green: palette.success.main,
    yellow: palette.warning.main,
    blue: palette.primary.main,
    magenta: palette.secondary.main,
    cyan: palette.info.main,
    white: isDark ? lighten(palette.text.primary, 0.08) : darken(palette.text.primary, 0.08),
    brightBlack: palette.text.secondary,
    brightRed: isDark ? lighten(palette.error.main, 0.12) : darken(palette.error.main, 0.08),
    brightGreen: isDark ? lighten(palette.success.main, 0.12) : darken(palette.success.main, 0.08),
    brightYellow: isDark ? lighten(palette.warning.main, 0.12) : darken(palette.warning.main, 0.08),
    brightBlue: isDark ? lighten(palette.primary.main, 0.12) : darken(palette.primary.main, 0.08),
    brightMagenta: isDark ? lighten(palette.secondary.main, 0.12) : darken(palette.secondary.main, 0.08),
    brightCyan: isDark ? lighten(palette.info.main, 0.12) : darken(palette.info.main, 0.08),
    brightWhite: palette.text.primary,
  };
}
