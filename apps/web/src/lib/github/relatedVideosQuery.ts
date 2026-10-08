/** Build a YouTube search query from a GitHub repo card. */

export type RelatedVideosQueryInput = {
  fullName: string;
  name: string;
  description?: string | null;
  language?: string | null;
  topics?: readonly string[];
};

/**
 * Prefer repo name + primary topic/language; keep under YouTube query max.
 */
export function buildRelatedVideosQuery(
  input: RelatedVideosQueryInput,
): string {
  const name = input.name.trim() || input.fullName.split("/")[1] || "";
  const topic = (input.topics ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const lang = input.language?.trim() || "";
  const parts = [name, topic || lang, "tutorial"].filter(
    (p) => p.length > 0,
  );
  const q = parts.join(" ").replace(/\s+/g, " ").trim();
  return q.slice(0, 200);
}

/** Path for Meanbox YouTube page deep link (localePrefix as-needed). */
export function youtubeBridgeHref(input: {
  q: string;
  videoId?: string | null;
}): string {
  const params = new URLSearchParams();
  const q = input.q.trim();
  if (q) params.set("q", q.slice(0, 200));
  if (input.videoId?.trim()) params.set("videoId", input.videoId.trim());
  const qs = params.toString();
  return qs ? `/youtube?${qs}` : "/youtube";
}
