import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadSettings, saveSettings } from "./settings";
import {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  type MeanboxLocale,
  type MeanboxSettings,
} from "./settingsCore";

type SettingsContextValue = {
  settings: MeanboxSettings;
  ready: boolean;
  setApiBase: (apiBase: string) => Promise<void>;
  setLocale: (locale: MeanboxLocale) => Promise<void>;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MeanboxSettings>({
    apiBase: DEFAULT_API_BASE,
    locale: DEFAULT_LOCALE,
  });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadSettings();
    setSettings(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setApiBase = useCallback(async (apiBase: string) => {
    const next = await saveSettings({ apiBase });
    setSettings(next);
  }, []);

  const setLocale = useCallback(async (locale: MeanboxLocale) => {
    const next = await saveSettings({ locale });
    setSettings(next);
  }, []);

  const value = useMemo(
    () => ({ settings, ready, setApiBase, setLocale, refresh }),
    [settings, ready, setApiBase, setLocale, refresh],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
