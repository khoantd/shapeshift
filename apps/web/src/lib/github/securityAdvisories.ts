/** Pure helpers for repository security advisories (GitHub REST). */

import type {
  GithubAdvisorySeverity,
  GithubSecurityAdvisory,
  GithubSecurityAdvisoryVulnerability,
} from "./types";

export const ADVISORIES_PER_PAGE = 10;
export const ADVISORIES_PER_PAGE_MAX = 30;

export const ADVISORY_STATES = [
  "triage",
  "draft",
  "published",
  "closed",
] as const;
export type AdvisoryStateFilter = (typeof ADVISORY_STATES)[number];

export const ADVISORY_SORTS = ["created", "updated", "published"] as const;
export type AdvisorySort = (typeof ADVISORY_SORTS)[number];

export const ADVISORY_DIRECTIONS = ["asc", "desc"] as const;
export type AdvisoryDirection = (typeof ADVISORY_DIRECTIONS)[number];

const SEVERITIES = new Set<GithubAdvisorySeverity>([
  "critical",
  "high",
  "medium",
  "low",
]);

const GHSA_ID_RE = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;

export type GithubAdvisoryRaw = {
  ghsa_id?: string;
  cve_id?: string | null;
  html_url?: string;
  summary?: string;
  severity?: string | null;
  state?: string;
  published_at?: string | null;
  updated_at?: string | null;
  vulnerabilities?: Array<{
    package?: {
      ecosystem?: string | null;
      name?: string | null;
    } | null;
    vulnerable_version_range?: string | null;
    patched_versions?: string | null;
  } | null> | null;
};

export type AdvisoriesListQuery = {
  state: AdvisoryStateFilter;
  sort: AdvisorySort;
  direction: AdvisoryDirection;
  perPage: number;
};

function asEnum<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = (raw ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

/** Parse list filters from query params; defaults match public published advisories. */
export function parseAdvisoriesListQuery(input: {
  state?: string | null;
  sort?: string | null;
  direction?: string | null;
  perPage?: string | null;
}): AdvisoriesListQuery {
  const perRaw = Number.parseInt((input.perPage ?? "").trim(), 10);
  const perPage = Number.isFinite(perRaw)
    ? Math.min(ADVISORIES_PER_PAGE_MAX, Math.max(1, perRaw))
    : ADVISORIES_PER_PAGE;
  return {
    state: asEnum(input.state, ADVISORY_STATES, "published"),
    sort: asEnum(input.sort, ADVISORY_SORTS, "published"),
    direction: asEnum(input.direction, ADVISORY_DIRECTIONS, "desc"),
    perPage,
  };
}

/** Validate GHSA identifier (e.g. GHSA-xxxx-xxxx-xxxx). */
export function parseGhsaId(
  raw: string | null | undefined,
): { ok: true; ghsaId: string } | { ok: false; error: string } {
  const id = (raw ?? "").trim();
  if (!GHSA_ID_RE.test(id)) {
    return {
      ok: false,
      error: "Expected ghsaId as GHSA-xxxx-xxxx-xxxx",
    };
  }
  return { ok: true, ghsaId: id.toUpperCase() };
}

function mapSeverity(
  raw: string | null | undefined,
): GithubAdvisorySeverity | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || v === "null") return null;
  return SEVERITIES.has(v as GithubAdvisorySeverity)
    ? (v as GithubAdvisorySeverity)
    : null;
}

function mapVulnerability(
  raw: NonNullable<GithubAdvisoryRaw["vulnerabilities"]>[number],
): GithubSecurityAdvisoryVulnerability | null {
  if (!raw || typeof raw !== "object") return null;
  const ecosystem =
    typeof raw.package?.ecosystem === "string"
      ? raw.package.ecosystem.trim() || null
      : null;
  const packageName =
    typeof raw.package?.name === "string"
      ? raw.package.name.trim() || null
      : null;
  const vulnerableVersionRange =
    typeof raw.vulnerable_version_range === "string"
      ? raw.vulnerable_version_range.trim() || null
      : null;
  const patchedVersions =
    typeof raw.patched_versions === "string"
      ? raw.patched_versions.trim() || null
      : null;
  if (!ecosystem && !packageName && !vulnerableVersionRange) return null;
  return {
    ecosystem,
    packageName,
    vulnerableVersionRange,
    patchedVersions,
  };
}

export function mapAdvisoryItem(
  raw: GithubAdvisoryRaw,
): GithubSecurityAdvisory | null {
  const ghsaId = (raw.ghsa_id ?? "").trim();
  const htmlUrl = (raw.html_url ?? "").trim();
  const summary = (raw.summary ?? "").trim();
  if (!ghsaId || !htmlUrl || !summary) return null;
  const vulns = Array.isArray(raw.vulnerabilities)
    ? raw.vulnerabilities
        .map(mapVulnerability)
        .filter((v): v is GithubSecurityAdvisoryVulnerability => Boolean(v))
    : [];
  return {
    ghsaId,
    cveId:
      typeof raw.cve_id === "string" && raw.cve_id.trim()
        ? raw.cve_id.trim()
        : null,
    htmlUrl,
    summary,
    severity: mapSeverity(raw.severity),
    state: typeof raw.state === "string" ? raw.state.trim() || "published" : "published",
    publishedAt:
      typeof raw.published_at === "string" && raw.published_at.trim()
        ? raw.published_at.trim()
        : null,
    updatedAt:
      typeof raw.updated_at === "string" && raw.updated_at.trim()
        ? raw.updated_at.trim()
        : null,
    vulnerabilities: vulns,
  };
}
