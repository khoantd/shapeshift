export function hasYouTubeDataApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim());
}

export function getYouTubeDataApiKey(): string {
  return process.env.YOUTUBE_DATA_API_KEY?.trim() ?? "";
}

export function youtubeConfigured(): boolean {
  return hasYouTubeDataApiKey();
}

export function missingYouTubeConfigMessage(): string {
  return "YOUTUBE_DATA_API_KEY is not set. Enable YouTube Data API v3 in Google Cloud, create a key, and add it to apps/web/.env (server-only).";
}
