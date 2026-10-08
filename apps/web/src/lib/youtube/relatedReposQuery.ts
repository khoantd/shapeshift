/** Build a GitHub repo search query from a YouTube video. */

export type RelatedReposQueryInput = {
  title: string;
  channelTitle?: string | null;
  /** Optional classify topic label from Jev. */
  topicLabel?: string | null;
};

const NOISE =
  /\b(official|trailer|full\s*course|tutorial|explained|review|vs\.?|part\s*\d+|ep\.?\s*\d+|howto|how\s*to|learn)\b/gi;

/**
 * Strip common YouTube fluff; keep meaningful tokens for GitHub Search.
 */
export function buildRelatedReposQuery(
  input: RelatedReposQueryInput,
): string {
  let title = input.title.replace(NOISE, " ").replace(/[|•·]/g, " ");
  title = title.replace(/\s+/g, " ").trim();
  const tokens = title
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  const topic = input.topicLabel?.trim();
  if (topic && topic.length >= 2 && !tokens.some((t) => t.toLowerCase() === topic.toLowerCase())) {
    tokens.push(topic);
  }
  const q = tokens.join(" ").trim();
  if (q.length >= 2) return q.slice(0, 100);
  const channel = input.channelTitle?.trim() ?? "";
  return channel.slice(0, 100) || "open source";
}

/** Path for Meanbox GitHub page deep link. */
export function githubBridgeHref(input: {
  q?: string | null;
  repo?: string | null;
}): string {
  const params = new URLSearchParams();
  const q = input.q?.trim();
  if (q) params.set("q", q.slice(0, 100));
  const repo = input.repo?.trim();
  if (repo) params.set("repo", repo);
  const qs = params.toString();
  return qs ? `/github?${qs}` : "/github";
}
