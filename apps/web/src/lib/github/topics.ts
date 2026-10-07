import type { GithubTopic } from "./types";

/** Max topics a user may save as favorites. */
export const MAX_FAVORITE_TOPICS = 12;

/** Curated language / interest chips for /github. */
export const GITHUB_TOPIC_CATALOG: readonly GithubTopic[] = [
  {
    id: "typescript",
    label: "TypeScript",
    githubLanguage: "TypeScript",
    newsQuery: "TypeScript programming",
  },
  {
    id: "javascript",
    label: "JavaScript",
    githubLanguage: "JavaScript",
    newsQuery: "JavaScript programming",
  },
  {
    id: "python",
    label: "Python",
    githubLanguage: "Python",
    newsQuery: "Python programming",
  },
  {
    id: "rust",
    label: "Rust",
    githubLanguage: "Rust",
    newsQuery: "Rust programming language",
  },
  {
    id: "go",
    label: "Go",
    githubLanguage: "Go",
    newsQuery: "Golang programming",
  },
  {
    id: "ai",
    label: "AI / ML",
    githubLanguage: null,
    newsQuery: "artificial intelligence machine learning open source",
  },
  {
    id: "llm",
    label: "LLMs",
    githubLanguage: null,
    newsQuery: "large language models LLM",
  },
  {
    id: "web",
    label: "Web",
    githubLanguage: null,
    newsQuery: "web development frameworks open source",
  },
  {
    id: "devops",
    label: "DevOps",
    githubLanguage: null,
    newsQuery: "DevOps Kubernetes CI/CD",
  },
  {
    id: "security",
    label: "Security",
    githubLanguage: null,
    newsQuery: "cybersecurity open source vulnerabilities",
  },
  {
    id: "database",
    label: "Databases",
    githubLanguage: null,
    newsQuery: "database open source PostgreSQL",
  },
  {
    id: "mobile",
    label: "Mobile",
    githubLanguage: null,
    newsQuery: "mobile development React Native Flutter",
  },
] as const;

const BY_ID = new Map(GITHUB_TOPIC_CATALOG.map((t) => [t.id, t]));

/** Default topics when the user has no favorites yet. */
export const DEFAULT_TRENDING_TOPICS = [
  "typescript",
  "python",
  "ai",
] as const;

export function getTopicById(id: string): GithubTopic | undefined {
  return BY_ID.get(normalizeTopicId(id));
}

export function normalizeTopicId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Keep only known catalog ids, dedupe, and cap at MAX_FAVORITE_TOPICS.
 */
export function normalizeFavoriteTopics(
  raw: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = normalizeTopicId(item);
    if (!id || !BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_FAVORITE_TOPICS) break;
  }
  return out;
}

export function resolveTopics(
  topicIds: readonly string[],
): GithubTopic[] {
  return normalizeFavoriteTopics(topicIds)
    .map((id) => BY_ID.get(id))
    .filter((t): t is GithubTopic => Boolean(t));
}

/** Parse `?topics=a,b` query into normalized catalog ids. */
export function parseTopicsQueryParam(
  raw: string | null | undefined,
): string[] {
  if (!raw?.trim()) return [];
  return normalizeFavoriteTopics(raw.split(/[,+]/));
}

export function topicsToQueryParam(topicIds: readonly string[]): string {
  return normalizeFavoriteTopics(topicIds).join(",");
}
