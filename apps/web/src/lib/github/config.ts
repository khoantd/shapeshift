/** Server-side GitHub + news config probes. */

export function githubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

/** GitHub Search works without a token but with a low rate limit. */
export function githubConfigured(): boolean {
  return true;
}

export function githubHasAuthToken(): boolean {
  return Boolean(githubToken());
}

export function missingGithubTokenHint(): string {
  return "Optional: set GITHUB_TOKEN for higher GitHub Search rate limits.";
}

export function serpApiKey(): string | null {
  return process.env.SERPAPI_API_KEY?.trim() || null;
}

export function githubNewsConfigured(): boolean {
  return Boolean(serpApiKey());
}

export function missingGithubNewsConfigMessage(): string {
  return "SERPAPI_API_KEY is not set. Topic headlines need SerpAPI (Google News).";
}
