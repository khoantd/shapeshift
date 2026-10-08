import {
  parseLearningPackLanguage,
  type LearningPackLanguage,
} from "@/lib/youtube/learningPackParse";
import { parseRepoFullName, truncateReadmeForSummary } from "./readme";
import { TREE_OUTLINE_MAX_CHARS } from "./repoTree";

export type RepoExplainerLanguage = LearningPackLanguage;

export type RepoExplainerChapter = {
  title: string;
  body: string;
};

export type RepoExplainerRequest = {
  fullName: string;
  description: string | null;
  readme: string;
  treeOutline: string;
  language: RepoExplainerLanguage;
  force?: boolean;
};

export type RepoExplainerParseError = { ok: false; error: string };
export type RepoExplainerParseOk = { ok: true; data: RepoExplainerRequest };

const DESCRIPTION_MAX = 500;

export function parseRepoExplainerRequest(
  body: unknown,
): RepoExplainerParseOk | RepoExplainerParseError {
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
  const treeRaw =
    typeof raw.treeOutline === "string"
      ? raw.treeOutline.replace(/\r\n/g, "\n")
      : typeof raw.outline === "string"
        ? raw.outline.replace(/\r\n/g, "\n")
        : "";
  const language = parseLearningPackLanguage(raw.language) ?? "en";
  const force = raw.force === true;

  return {
    ok: true,
    data: {
      fullName: parsed.fullName,
      description,
      readme: readmeRaw ? truncateReadmeForSummary(readmeRaw) : "",
      treeOutline: treeRaw.slice(0, TREE_OUTLINE_MAX_CHARS),
      language,
      ...(force ? { force: true } : {}),
    },
  };
}

export function repoExplainerCacheKey(input: RepoExplainerRequest): string {
  const t = input.treeOutline;
  const r = input.readme;
  const fingerprint = `${t.length}:${t.slice(0, 48)}:${r.length}:${r.slice(0, 48)}`;
  return [input.fullName, input.language, fingerprint].join("::");
}

export function buildRepoExplainerPrompt(input: RepoExplainerRequest): string {
  const lang = input.language === "vi" ? "Vietnamese" : "English";
  const meta = [
    `Repository: ${input.fullName}`,
    input.description ? `Description: ${input.description}` : null,
    `Output language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You write a short narrated explainer script for a GitHub repository (like a 60-second video outline).

${meta}

Rules:
- Output ONLY valid JSON (no markdown fences): {"chapters":[{"title":"...","body":"..."}, ...]}
- Exactly 3 or 4 chapters:
  1) What it is / who it's for
  2) Main parts of the codebase
  3) One under-the-hood decision
  4) Optional: how to get started (only if README supports it)
- Each body: 2–4 short sentences in ${lang}. Fidelity over fabrication — use tree + README only.
- Titles under 60 characters.

File tree outline:
---
${input.treeOutline || "(empty tree)"}
---

README excerpt:
---
${input.readme || "(empty README)"}
---
`;
}

export function parseExplainerChapters(raw: string): RepoExplainerChapter[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let jsonText = trimmed;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) jsonText = fence[1].trim();
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const chapters = (parsed as { chapters?: unknown }).chapters;
    if (!Array.isArray(chapters)) return null;
    const out: RepoExplainerChapter[] = [];
    for (const row of chapters) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const body = typeof r.body === "string" ? r.body.trim() : "";
      if (!title || !body) continue;
      out.push({
        title: title.slice(0, 80),
        body: body.slice(0, 1200),
      });
    }
    if (out.length < 2) return null;
    return out.slice(0, 5);
  } catch {
    return null;
  }
}
