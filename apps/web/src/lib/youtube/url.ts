/**
 * Extract an 11-character YouTube video ID from common URL shapes, or null.
 * Supports watch, youtu.be, embed, shorts, and live paths.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare 11-char id (alphanumeric, underscore, hyphen)
  if (/^[\w-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const isYouTube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com";
  if (!isYouTube) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  const v = url.searchParams.get("v");
  if (v && /^[\w-]{11}$/.test(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts[0];
  if (
    (marker === "embed" || marker === "shorts" || marker === "live" || marker === "v") &&
    parts[1] &&
    /^[\w-]{11}$/.test(parts[1])
  ) {
    return parts[1];
  }

  return null;
}

export function looksLikeYouTubeUrl(input: string): boolean {
  return extractYouTubeVideoId(input) !== null && /youtu\.?be|youtube/i.test(input);
}

/** Canonical watch URL for a validated 11-char video id. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId.trim())}`;
}
