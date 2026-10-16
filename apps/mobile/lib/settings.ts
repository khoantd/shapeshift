/** Meanbox API base + locale preferences (AsyncStorage). */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  normalizeApiBase,
  normalizeLocale,
  type MeanboxLocale,
  type MeanboxSettings,
} from "./settingsCore";

export {
  DEFAULT_API_BASE,
  DEFAULT_LOCALE,
  deepDiveLanguage,
  meanboxHref,
  normalizeApiBase,
  normalizeLocale,
  type MeanboxLocale,
  type MeanboxSettings,
} from "./settingsCore";

const STORAGE_KEY = "meanbox.settings";

function envDefaultApiBase(): string {
  const extra = Constants.expoConfig?.extra as
    | { apiBase?: string }
    | undefined;
  const fromExtra =
    typeof extra?.apiBase === "string" ? extra.apiBase.trim() : "";
  const fromProcess =
    typeof process !== "undefined" &&
    typeof process.env?.EXPO_PUBLIC_API_BASE === "string"
      ? process.env.EXPO_PUBLIC_API_BASE.trim()
      : "";
  return (
    normalizeApiBase(fromProcess) ||
    normalizeApiBase(fromExtra) ||
    DEFAULT_API_BASE
  );
}

export async function loadSettings(): Promise<MeanboxSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { apiBase: envDefaultApiBase(), locale: DEFAULT_LOCALE };
    }
    const parsed = JSON.parse(raw) as Partial<MeanboxSettings>;
    return {
      apiBase: normalizeApiBase(parsed.apiBase) || envDefaultApiBase(),
      locale: normalizeLocale(parsed.locale),
    };
  } catch {
    return { apiBase: envDefaultApiBase(), locale: DEFAULT_LOCALE };
  }
}

export async function saveSettings(
  next: Partial<MeanboxSettings>,
): Promise<MeanboxSettings> {
  const current = await loadSettings();
  const patch: MeanboxSettings = { ...current };
  if (next.apiBase !== undefined) {
    const base = normalizeApiBase(next.apiBase);
    if (!base) throw new Error("API base must be a valid http(s) URL");
    patch.apiBase = base;
  }
  if (next.locale !== undefined) {
    patch.locale = normalizeLocale(next.locale);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(patch));
  return patch;
}

export type { MeanboxLocale as Locale };
