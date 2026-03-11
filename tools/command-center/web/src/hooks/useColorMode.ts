import { createContext, useContext } from "react";

export interface ColorModeContextValue {
  mode: "light" | "dark";
  toggle: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "dark",
  toggle: () => {},
});

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
