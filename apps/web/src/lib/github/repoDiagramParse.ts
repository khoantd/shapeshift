import {
  parseLearningPackLanguage,
  type LearningPackLanguage,
} from "@/lib/youtube/learningPackParse";
import { parseRepoFullName, truncateReadmeForSummary } from "./readme";
import { TREE_OUTLINE_MAX_CHARS } from "./repoTree";

export type RepoDiagramLanguage = LearningPackLanguage;

export type RepoDiagramRequest = {
  fullName: string;
  description: string | null;
  readme: string;
  treeOutline: string;
  language: RepoDiagramLanguage;
  force?: boolean;
};

export type RepoDiagramParseError = { ok: false; error: string };
export type RepoDiagramParseOk = { ok: true; data: RepoDiagramRequest };

const DESCRIPTION_MAX = 500;

export function parseRepoDiagramRequest(
  body: unknown,
): RepoDiagramParseOk | RepoDiagramParseError {
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

export function repoDiagramCacheKey(input: RepoDiagramRequest): string {
  const t = input.treeOutline;
  const r = input.readme;
  const fingerprint = `${t.length}:${t.slice(0, 48)}:${r.length}:${r.slice(0, 48)}`;
  return [input.fullName, input.language, fingerprint].join("::");
}

export function buildRepoDiagramPrompt(input: RepoDiagramRequest): string {
  const lang = input.language === "vi" ? "Vietnamese" : "English";
  const meta = [
    `Repository: ${input.fullName}`,
    input.description ? `Description: ${input.description}` : null,
    `Notes language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a software architect. From the repository file tree and README excerpt, produce an architecture diagram.

${meta}

Rules:
- Output ONLY a Mermaid flowchart (flowchart TD or flowchart LR) in a \`\`\`mermaid fenced block.
- 6–14 nodes max. Group by layer (apps, packages, API, data) when the tree supports it.
- Node labels: short human names. Use alphanumeric node IDs (A, B, api, web).
- Optional: after the fence, 2–4 short bullet notes in ${lang} explaining the main parts.
- Fidelity: do not invent services not suggested by paths/README. Prefer directories over every file.
- Do not use %%{init...}%%. Do not use click handlers except https://github.com/${input.fullName}/... links.

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
