/** Return false when JWT `exp` is missing or already past (with 60s skew). */
export function isJwtUnexpired(token: string, nowMs = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length < 2) return false;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 > nowMs + 60_000;
  } catch {
    return false;
  }
}
