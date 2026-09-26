/** Shared Inspired Canvas Supabase env (no server-only — safe for server modules). */

export function getInspiredCanvasSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = (process.env.INSPIRED_CANVAS_SUPABASE_URL ?? "").trim();
  const anonKey = (
    process.env.INSPIRED_CANVAS_SUPABASE_PUBLISHABLE_KEY ??
    process.env.INSPIRED_CANVAS_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
