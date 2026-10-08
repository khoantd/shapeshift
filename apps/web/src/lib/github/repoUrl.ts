/** Parse `owner/repo`, HTTPS, or SSH GitHub URLs into owner/name. */

export type ParsedGitHubRepo = {
  owner: string;
  name: string;
  fullName: string;
};

const GITHUB_URL_PATTERN =
  /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:[/?#].*)?$/i;
const GITHUB_SSH_PATTERN =
  /^(?:ssh:\/\/)?git@github\.com[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/i;
const GITHUB_REPO_SHORTHAND_PATTERN =
  /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

const GIT_SUFFIX = ".git";

function stripGitSuffix(repo: string): string {
  if (repo.endsWith(GIT_SUFFIX) && repo.length > GIT_SUFFIX.length) {
    return repo.slice(0, -GIT_SUFFIX.length);
  }
  return repo;
}

function normalizeGitHubRepoUrl(input: string): string {
  const trimmed = input.trim();
  if (GITHUB_REPO_SHORTHAND_PATTERN.test(trimmed)) {
    return `https://github.com/${trimmed}`;
  }
  return trimmed;
}

function matchRepoSegments(input: string): [string, string] | null {
  const httpsMatch = GITHUB_URL_PATTERN.exec(input);
  if (httpsMatch?.[1] && httpsMatch[2]) {
    return [httpsMatch[1], httpsMatch[2]];
  }
  const sshMatch = GITHUB_SSH_PATTERN.exec(input);
  if (sshMatch?.[1] && sshMatch[2]) {
    return [sshMatch[1], sshMatch[2]];
  }
  return null;
}

/** Returns null when the input is not a recognizable GitHub repo reference. */
export function parseGitHubRepoUrl(
  raw: string | null | undefined,
): ParsedGitHubRepo | null {
  if (typeof raw !== "string") return null;
  const segments = matchRepoSegments(normalizeGitHubRepoUrl(raw));
  if (!segments) return null;
  const [owner, repoRaw] = segments;
  const name = stripGitSuffix(repoRaw);
  if (!owner || !name) return null;
  return { owner, name, fullName: `${owner}/${name}` };
}

/** GitDiagram deep links for the same public repo. */
export function gitDiagramUrls(fullName: string): {
  diagram: string;
  video: string;
} {
  const path = fullName
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  return {
    diagram: `https://gitdiagram.com/${path}`,
    video: `https://gitdiagram.com/${path}/video`,
  };
}
