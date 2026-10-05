/** Format YouTube ISO-8601 duration (e.g. PT1H2M3S) to a short clock string. */
export function formatYouTubeDuration(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const m = iso.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  if (!h && !min && !s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(min)}:${pad(s)}`;
  return `${min}:${pad(s)}`;
}
