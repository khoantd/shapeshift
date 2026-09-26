import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getInspiredCanvasSupabaseEnv } from "./env";
import { isJwtUnexpired } from "./jwt";

/**
 * Inspired Canvas authenticates `/api/context/cxo-feed-items` with a Supabase
 * user JWT (`authenticateBearer` in inspired-canvas/server/context/supabaseAuth.ts).
 * Same pattern as StratAI / companion: IC project URL + publishable key, then
 * either a pasted access token or signInWithPassword.
 */

type CachedSession = { token: string; expiresAtMs: number };

let passwordSessionCache: CachedSession | null = null;

export { getInspiredCanvasSupabaseEnv } from "./env";
export { isJwtUnexpired } from "./jwt";

function parseBearer(authorization: string | null | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export type InspiredCanvasAuthResult = {
  token: string | null;
  error: string | null;
};

async function mintAccessTokenWithPassword(): Promise<InspiredCanvasAuthResult> {
  const email = (process.env.INSPIRED_CANVAS_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.INSPIRED_CANVAS_PASSWORD ?? "";
  if (!email || !password.trim()) {
    return { token: null, error: inspiredCanvasTokenMissingMessage() };
  }

  const now = Date.now();
  if (passwordSessionCache && passwordSessionCache.expiresAtMs > now + 60_000) {
    return { token: passwordSessionCache.token, error: null };
  }

  const env = getInspiredCanvasSupabaseEnv();
  if (!env) {
    return {
      token: null,
      error:
        "Inspired Canvas Supabase URL/key missing. Set INSPIRED_CANVAS_SUPABASE_URL and INSPIRED_CANVAS_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    const detail = error?.message?.trim() || "no session";
    console.error("[inspired-canvas] signInWithPassword failed:", detail);
    return {
      token: null,
      error: `Inspired Canvas login failed (${detail}). Check INSPIRED_CANVAS_EMAIL / INSPIRED_CANVAS_PASSWORD for the IC Supabase user.`,
    };
  }

  const token = data.session.access_token.trim();
  const expiresAtMs =
    typeof data.session.expires_at === "number"
      ? data.session.expires_at * 1000
      : now + 50 * 60_000;
  passwordSessionCache = { token, expiresAtMs };
  return { token, error: null };
}

/** Resolve IC user JWT: request Bearer → unexpired ACCESS_TOKEN → email/password mint. */
export async function resolveInspiredCanvasAccessToken(
  authorizationHeader?: string | null,
): Promise<string | null> {
  const result = await resolveInspiredCanvasAuth(authorizationHeader);
  return result.token;
}

/** Same as resolveInspiredCanvasAccessToken, but includes a user-facing error. */
export async function resolveInspiredCanvasAuth(
  authorizationHeader?: string | null,
): Promise<InspiredCanvasAuthResult> {
  const fromHeader = parseBearer(authorizationHeader);
  if (fromHeader) {
    if (isJwtUnexpired(fromHeader)) return { token: fromHeader, error: null };
    return {
      token: null,
      error: "Authorization Bearer token is expired. Sign in again or use EMAIL/PASSWORD mint.",
    };
  }

  const fromEnv = (process.env.INSPIRED_CANVAS_ACCESS_TOKEN ?? "").trim();
  if (fromEnv && isJwtUnexpired(fromEnv)) return { token: fromEnv, error: null };

  return mintAccessTokenWithPassword();
}

export function inspiredCanvasTokenMissingMessage(): string {
  return (
    "Inspired Canvas token missing or expired. Set INSPIRED_CANVAS_EMAIL + " +
    "INSPIRED_CANVAS_PASSWORD (preferred), or a fresh INSPIRED_CANVAS_ACCESS_TOKEN, " +
    "in apps/web/.env or the monorepo root .env."
  );
}
