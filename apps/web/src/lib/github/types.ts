/** Shared DTOs for the /github monitor surface. */

export type GithubTopic = {
  id: string;
  label: string;
  /** GitHub Search `language:` qualifier when set. */
  githubLanguage: string | null;
  /** SerpAPI / Google News query fragment. */
  newsQuery: string;
};

export type GithubRepoCard = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  pushedAt: string | null;
  createdAt: string | null;
  matchedTopicIds: string[];
};

export type GithubReleaseItem = {
  id: number;
  repoFullName: string;
  tagName: string;
  name: string | null;
  htmlUrl: string;
  publishedAt: string | null;
  prerelease: boolean;
};

export type GithubHeadline = {
  id: string;
  title: string;
  link: string;
  source: string | null;
  date: string | null;
  snippet: string | null;
  topicId: string | null;
};

export type GithubTrendingResult = {
  repos: GithubRepoCard[];
  topicsUsed: string[];
  fetchedAt: number;
  windowDays: number;
};

export type GithubSearchResult = {
  repos: GithubRepoCard[];
  query: string;
  fetchedAt: number;
};

export type GithubNewsResult = {
  headlines: GithubHeadline[];
  topicsUsed: string[];
  fetchedAt: number;
};

export type GithubActivityResult = {
  releases: GithubReleaseItem[];
  reposQueried: string[];
  fetchedAt: number;
};

export type GithubRepoReadme = {
  fullName: string;
  markdown: string;
  truncated: boolean;
  htmlUrl: string | null;
  fetchedAt: number;
};
