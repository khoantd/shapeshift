/** Persist Meanbox OAuth session bridge for native fetch (X-Meanbox-Cookie). */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const MEANBOX_SESSION_COOKIE_HEADER = "X-Meanbox-Cookie";
export const MOBILE_OAUTH_REDIRECT = "meanbox://oauth";
export const MOBILE_OAUTH_RETURN_TO = "/api/youtube/oauth/mobile-bridge";

const STORAGE_KEY = "meanbox.oauth.bridge";

export type MeanboxSession = {
  bridge: string;
  email: string | null;
};

export function parseMobileOAuthRedirect(
  url: string,
): { ok: true; session: MeanboxSession } | { ok: false; error: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "meanbox:") {
      return { ok: false, error: "unexpected_scheme" };
    }
    const error = parsed.searchParams.get("error");
    if (error) {
      return { ok: false, error };
    }
    const bridge = parsed.searchParams.get("bridge")?.trim() || "";
    if (!bridge || !bridge.includes("yt_oauth_")) {
      return { ok: false, error: "missing_bridge" };
    }
    const emailRaw = parsed.searchParams.get("email")?.trim() || "";
    return {
      ok: true,
      session: {
        bridge,
        email: emailRaw || emailFromBridge(bridge),
      },
    };
  } catch {
    return { ok: false, error: "invalid_url" };
  }
}

function emailFromBridge(bridge: string): string | null {
  for (const part of bridge.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name === "yt_oauth_email" && value) return value;
  }
  return null;
}

export async function loadSession(): Promise<MeanboxSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeanboxSession>;
    if (typeof parsed.bridge !== "string" || !parsed.bridge.includes("yt_oauth_")) {
      return null;
    }
    return {
      bridge: parsed.bridge,
      email: typeof parsed.email === "string" && parsed.email ? parsed.email : null,
    };
  } catch {
    return null;
  }
}

export async function saveSession(session: MeanboxSession): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bridge: session.bridge,
      email: session.email,
    }),
  );
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
