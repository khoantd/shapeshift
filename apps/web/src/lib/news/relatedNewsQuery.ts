/** Query builders and deep links for the News ↔ YouTube ↔ GitHub bridge. */

const YT_NOISE =
  /\b(official|trailer|full\s*course|tutorial|explained|review|vs\.?|part\s*\d+|ep\.?\s*\d+|howto|how\s*to|learn)\b/gi;

const NEWS_NOISE =
  /\b(release|releases|notes|announces|announced|launches|launched|introduces|unveils|update|updates)\b/gi;

function tokensFromTitle(
  title: string,
  noise: RegExp,
  maxTokens: number,
): string[] {
  let cleaned = title.replace(noise, " ").replace(/[|•·:—–-]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, maxTokens);
}

export type RelatedNewsFromRepoInput = {
  fullName: string;
  name: string;
  description?: string | null;
  language?: string | null;
  topics?: readonly string[];
};

/** Build a News feed filter query from a GitHub repo card. */
export function buildRelatedNewsFromRepoQuery(
  input: RelatedNewsFromRepoInput,
): string {
  const name = input.name.trim() || input.fullName.split("/")[1] || "";
  const topic = (input.topics ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const lang = input.language?.trim() || "";
  const parts = [name, topic || lang].filter((p) => p.length > 0);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
}

export type RelatedNewsFromVideoInput = {
  title: string;
  channelTitle?: string | null;
  topicLabel?: string | null;
};

/** Build a News feed filter query from a YouTube video. */
export function buildRelatedNewsFromVideoQuery(
  input: RelatedNewsFromVideoInput,
): string {
  const tokens = tokensFromTitle(input.title, YT_NOISE, 6);
  const topic = input.topicLabel?.trim();
  if (
    topic &&
    topic.length >= 2 &&
    !tokens.some((t) => t.toLowerCase() === topic.toLowerCase())
  ) {
    tokens.push(topic);
  }
  const q = tokens.join(" ").trim();
  if (q.length >= 2) return q.slice(0, 200);
  const channel = input.channelTitle?.trim() ?? "";
  return channel.slice(0, 200) || "technology";
}

export type RelatedVideosFromNewsInput = {
  title: string;
  sourceDisplayName?: string | null;
};

/** Build a YouTube search query from a news story. */
export function buildRelatedVideosFromNewsQuery(
  input: RelatedVideosFromNewsInput,
): string {
  const tokens = tokensFromTitle(input.title, NEWS_NOISE, 6);
  if (tokens.length > 0) {
    return [...tokens, "explained"].join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
  }
  const source = input.sourceDisplayName?.trim() ?? "";
  if (source) return `${source} explained`.slice(0, 200);
  return "tech news explained";
}

export type RelatedReposFromNewsInput = {
  title: string;
  sourceDisplayName?: string | null;
};

/** Build a GitHub search query from a news story. */
export function buildRelatedReposFromNewsQuery(
  input: RelatedReposFromNewsInput,
): string {
  const tokens = tokensFromTitle(input.title, NEWS_NOISE, 6);
  const q = tokens.join(" ").trim();
  if (q.length >= 2) return q.slice(0, 100);
  const source = input.sourceDisplayName?.trim() ?? "";
  return source.slice(0, 100) || "open source";
}

/** Path for Meanbox News page deep link (localePrefix as-needed). */
export function newsBridgeHref(input: {
  q?: string | null;
  story?: string | null;
}): string {
  const params = new URLSearchParams();
  const q = input.q?.trim();
  if (q) params.set("q", q.slice(0, 200));
  const story = input.story?.trim();
  if (story) params.set("story", story.slice(0, 200));
  const qs = params.toString();
  return qs ? `/news?${qs}` : "/news";
}
