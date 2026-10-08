/** Local recent-repo chips for /github (client-only). */

export const RECENT_REPOS_KEY = "meanbox:github:recent";
export const RECENT_REPOS_MAX = 8;

export type RecentRepoChip = {
  fullName: string;
  visitedAt: number;
};

export function parseRecentRepos(raw: unknown): RecentRepoChip[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentRepoChip[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const fullName =
      typeof r.fullName === "string" ? r.fullName.trim() : "";
    const visitedAt =
      typeof r.visitedAt === "number" && Number.isFinite(r.visitedAt)
        ? r.visitedAt
        : 0;
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(fullName)) continue;
    const key = fullName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fullName, visitedAt });
  }
  return out
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, RECENT_REPOS_MAX);
}

export function pushRecentRepo(
  list: readonly RecentRepoChip[],
  fullName: string,
  now = Date.now(),
): RecentRepoChip[] {
  const normalized = fullName.trim();
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(normalized)) {
    return parseRecentRepos(list);
  }
  const rest = list.filter(
    (r) => r.fullName.toLowerCase() !== normalized.toLowerCase(),
  );
  return parseRecentRepos([
    { fullName: normalized, visitedAt: now },
    ...rest,
  ]);
}

export function readRecentRepos(): RecentRepoChip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_REPOS_KEY);
    if (!raw) return [];
    return parseRecentRepos(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function writeRecentRepos(list: readonly RecentRepoChip[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      RECENT_REPOS_KEY,
      JSON.stringify(parseRecentRepos(list)),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearRecentRepos(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_REPOS_KEY);
  } catch {
    /* ignore */
  }
}
