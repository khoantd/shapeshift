import {
  parseLearningPackLanguage,
  type LearningPackLanguage,
} from "@/lib/youtube/learningPackParse";
import { parseRepoFullName, truncateReadmeForSummary } from "./readme";

export type RepoSummaryLanguage = LearningPackLanguage;

export type RepoSummaryRequest = {
  fullName: string;
  description: string | null;
  readme: string;
  language: RepoSummaryLanguage;
  force?: boolean;
};

export type RepoSummaryParseError = { ok: false; error: string };
export type RepoSummaryParseOk = { ok: true; data: RepoSummaryRequest };

const DESCRIPTION_MAX = 500;

/**
 * Parse POST body for repo summarize.
 * `readme` may be omitted — the route fetches it when missing.
 */
export function parseRepoSummaryRequest(
  body: unknown,
): RepoSummaryParseOk | RepoSummaryParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { repo }" };
  }
  const raw = body as Record<string, unknown>;
  const repoRaw =
    typeof raw.repo === "string"
      ? raw.repo
      : typeof raw.fullName === "string"
        ? raw.fullName
        : "";
  const parsed = parseRepoFullName(repoRaw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const description =
    typeof raw.description === "string"
      ? raw.description.trim().slice(0, DESCRIPTION_MAX) || null
      : null;
  const readmeRaw =
    typeof raw.readme === "string" ? raw.readme.replace(/\r\n/g, "\n") : "";
  const language = parseLearningPackLanguage(raw.language) ?? "en";
  const force = raw.force === true;

  return {
    ok: true,
    data: {
      fullName: parsed.fullName,
      description,
      readme: readmeRaw ? truncateReadmeForSummary(readmeRaw) : "",
      language,
      ...(force ? { force: true } : {}),
    },
  };
}

export function repoSummaryCacheKey(input: RepoSummaryRequest): string {
  const t = input.readme;
  const fingerprint = `${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`;
  return [input.fullName, input.language, fingerprint].join("::");
}

/**
 * Build the Perplexity prompt for a short repo README summary.
 * No web research — README (+ description) is the sole source.
 */
export function buildRepoSummaryPrompt(input: RepoSummaryRequest): string {
  const lang = input.language === "vi" ? "Vietnamese" : "English";
  const meta = [
    `Repository: ${input.fullName}`,
    input.description ? `Description: ${input.description}` : null,
    `Output language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a developer assistant. Summarize this GitHub repository from its README in Markdown for someone deciding whether to explore or use it.

${meta}

Rules:
- Fidelity over fabrication: everything must trace to the README (and description). Never invent stars, licenses, or features not present.
- Prefer short sections: **What it is**, **Who it's for**, **Key features**, **Stack / requirements** when the README supports them.
- Keep the whole summary under ~250 words. Use bullets where helpful.
- Output ONLY the Markdown summary — no preamble.

README:
---
${input.readme || "(empty README)"}
---
`;
}
