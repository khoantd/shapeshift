import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { tokens, type MeanboxTokens } from "./tokens";

const ThemeContext = createContext<MeanboxTokens>(tokens);

export type MeanboxThemeProviderProps = {
  children: ReactNode;
  /** Override for tests or white-label; defaults to Meanbox tokens. */
  value?: MeanboxTokens;
};

/**
 * Provides Meanbox design tokens to the mobile tree.
 * Expo/RN screens consume via `useMeanboxTheme()` — no react-native import required here.
 */
export function MeanboxThemeProvider({
  children,
  value = tokens,
}: MeanboxThemeProviderProps) {
  const memo = useMemo(() => value, [value]);
  return (
    <ThemeContext.Provider value={memo}>{children}</ThemeContext.Provider>
  );
}

export function useMeanboxTheme(): MeanboxTokens {
  return useContext(ThemeContext);
}
