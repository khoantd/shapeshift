function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Supabase user id (`sub`) from an access token, or null if missing/invalid. */
export function jwtSub(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  return sub || null;
}

/** Return false when JWT `exp` is missing or already past (with 60s skew). */
export function isJwtUnexpired(token: string, nowMs = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (typeof payload.exp !== "number") return false;
  return payload.exp * 1000 > nowMs + 60_000;
}
