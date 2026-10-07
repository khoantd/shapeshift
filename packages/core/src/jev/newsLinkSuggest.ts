import { z } from "zod";
import { NEWS_LINK_SUGGEST_QUESTION_COUNT } from "./newsLinkSuggestQuestions";

export const NEWS_LINK_TYPES = ["RELATED_TO", "SUPPORTS", "CONTRASTS_WITH"] as const;
export type NewsLinkType = (typeof NEWS_LINK_TYPES)[number];

export const newsLinkSuggestRequestSchema = z.object({
  sourceName: z.string().trim().max(200),
  targetName: z.string().trim().max(200),
  sourceContext: z.string().trim().max(2000).optional(),
  targetContext: z.string().trim().max(2000).optional(),
});

export type NewsLinkSuggestRequest = z.infer<typeof newsLinkSuggestRequestSchema>;

export type NewsLinkSuggestResult = {
  linkType: NewsLinkType;
  confidence: number;
  line: string;
  latencyMs: number;
  questionCount: number;
  model: string;
  source: "jev" | "mock";
};

const CONTRAST_RE =
  /\b(unlike|contrast|versus|vs\.?|oppose|opposing|conflict|contrary|however|whereas|while\s+\w+\s+(fell|declined|dropped)|lawsuit|rival|against)\b/i;
const SUPPORT_RE =
  /\b(support|supports|confirm|corroborat|align|reinforc|enables?|backed|consistent\s+with|because\s+of|driven\s+by)\b/i;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function linkTypeLabel(linkType: NewsLinkType): string {
  if (linkType === "SUPPORTS") return "Supports";
  if (linkType === "CONTRASTS_WITH") return "Contrasts with";
  return "Related to";
}

function confidenceLabel(score: number): string {
  if (score >= 0.67) return "High confidence";
  if (score >= 0.34) return "Moderate confidence";
  return "Low confidence";
}

/** Compose a short suggestion line from structured Jev/mock scores. */
export function composeNewsLinkSuggestLine(input: {
  linkType: NewsLinkType;
  confidence: number;
}): string {
  return `${linkTypeLabel(input.linkType)} · ${confidenceLabel(input.confidence)}`;
}

/** Offline keyword suggest when TypeSafe/Jev is unavailable. */
export function mockSuggestNewsLink(input: NewsLinkSuggestRequest): NewsLinkSuggestResult {
  const sourceName = input.sourceName.trim();
  const targetName = input.targetName.trim();
  const sourceContext = (input.sourceContext ?? "").trim();
  const targetContext = (input.targetContext ?? "").trim();
  const blob = `${sourceName} ${targetName} ${sourceContext} ${targetContext}`;

  let linkType: NewsLinkType = "RELATED_TO";
  let confidence = 0.4;

  if (!sourceName || !targetName) {
    confidence = 0.2;
  } else if (CONTRAST_RE.test(blob)) {
    linkType = "CONTRASTS_WITH";
    confidence = 0.75;
  } else if (SUPPORT_RE.test(blob)) {
    linkType = "SUPPORTS";
    confidence = 0.7;
  } else if (sourceContext || targetContext) {
    confidence = 0.45;
  }

  const result: NewsLinkSuggestResult = {
    linkType,
    confidence: clamp01(confidence),
    latencyMs: 0,
    questionCount: NEWS_LINK_SUGGEST_QUESTION_COUNT,
    model: "jev-offline",
    source: "mock",
    line: "",
  };
  result.line = composeNewsLinkSuggestLine({
    linkType: result.linkType,
    confidence: result.confidence,
  });
  return result;
}

export function newsLinkTextForSuggest(input: NewsLinkSuggestRequest): string {
  const sourceName = input.sourceName.trim() || "Unknown";
  const targetName = input.targetName.trim() || "Unknown";
  const sourceContext = (input.sourceContext ?? "").trim();
  const targetContext = (input.targetContext ?? "").trim();
  const parts = [
    `Source entity: ${sourceName}`,
    `Target entity: ${targetName}`,
  ];
  if (sourceContext) parts.push(`Source context:\n${sourceContext}`);
  if (targetContext) parts.push(`Target context:\n${targetContext}`);
  return parts.join("\n\n");
}
