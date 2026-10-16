/**
 * HTTPS origin YouTube requires as Referer for embeds in WebViews (Error 153).
 * Matches Expo ios.bundleIdentifier / android.package.
 */
export const YOUTUBE_EMBED_ORIGIN = "https://app.meanbox.mobile";

/** YouTube watch URL for external app / browser handoff. */
export function youtubeWatchUrl(videoId: string): string {
  const id = String(videoId ?? "").trim();
  if (!id) return "";
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

/** Embed URL for in-app WebView playback (playsinline for iOS). */
export function youtubeEmbedUrl(videoId: string): string {
  const id = String(videoId ?? "").trim();
  if (!id) return "";
  const origin = encodeURIComponent(YOUTUBE_EMBED_ORIGIN);
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&origin=${origin}`;
}

/**
 * HTML document hosting the embed iframe with baseUrl/referrer so WKWebView
 * sends a valid Referer (avoids YouTube Error 153).
 */
export function youtubeEmbedHtml(videoId: string): string {
  const src = youtubeEmbedUrl(videoId);
  if (!src) return "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe
    src="${src}"
    title="YouTube"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    allowfullscreen
  ></iframe>
</body>
</html>`;
}
