import { z } from "zod";
import { NEWS_BRIEF_QUESTION_COUNT } from "./newsBriefQuestions";

export const NEWS_BRIEF_TONES = ["neutral", "caution", "opportunity"] as const;
export type NewsBriefTone = (typeof NEWS_BRIEF_TONES)[number];

export const NEWS_BRIEF_LANGUAGES = ["en", "vi"] as const;
export type NewsBriefLanguage = (typeof NEWS_BRIEF_LANGUAGES)[number];

export const newsBriefRequestSchema = z.object({
  title: z.string().trim().max(500),
  excerpt: z.string().trim().max(4000),
  query: z.string().trim().max(200).optional(),
  language: z.enum(NEWS_BRIEF_LANGUAGES).optional().default("en"),
});

export type NewsBriefRequest = z.infer<typeof newsBriefRequestSchema>;

/** Threshold for worthDeepDive / worthGraph badges. */
export const NEWS_TRIAGE_THRESHOLD = 0.55;

export type NewsBriefResult = {
  urgency: number;
  relevance: number;
  tone: NewsBriefTone;
  worthDeepDive: boolean;
  worthDeepDiveScore: number;
  worthGraph: boolean;
  worthGraphScore: number;
  line: string;
  latencyMs: number;
  questionCount: number;
  model: string;
  source: "jev" | "mock";
};

const CRITICAL_RE =
  /\b(critical|urgent|breaking|must[- ]know|crisis|risk|alert|emergency|threat)\b/i;
const OPPORTUNITY_RE =
  /\b(breakthrough|launch|record|growth|wins?|surge|opportunity|innovation)\b/i;
const CAUTION_RE =
  /\b(warn|risk|crisis|fail|crash|ban|lawsuit|hack|outage|decline|cut)\b/i;
const ENTITY_RE =
  /\b([A-Z][\w&.-]+(?:\s+[A-Z][\w&.-]+){0,3}|bank|company|minister|ceo|regulator)\b/;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function urgencyLabel(score: number, language: NewsBriefLanguage): string {
  if (language === "vi") {
    if (score >= 0.67) return "Khẩn cấp";
    if (score >= 0.34) return "Nhạy cảm thời gian";
    return "Ít khẩn";
  }
  if (score >= 0.67) return "Urgent";
  if (score >= 0.34) return "Time-sensitive";
  return "Low urgency";
}

function relevanceLabel(score: number, hasQuery: boolean, language: NewsBriefLanguage): string {
  if (language === "vi") {
    if (!hasQuery) return "Chung";
    if (score >= 0.67) return "Rất liên quan";
    if (score >= 0.34) return "Hơi liên quan";
    return "Ít liên quan";
  }
  if (!hasQuery) return "General";
  if (score >= 0.67) return "Highly relevant";
  if (score >= 0.34) return "Somewhat relevant";
  return "Low relevance";
}

function toneLabel(tone: NewsBriefTone, language: NewsBriefLanguage): string {
  if (language === "vi") {
    if (tone === "caution") return "Giọng thận trọng";
    if (tone === "opportunity") return "Giọng cơ hội";
    return "Giọng trung lập";
  }
  if (tone === "caution") return "Cautionary tone";
  if (tone === "opportunity") return "Opportunity tone";
  return "Neutral tone";
}

/** Compose a short briefing line from structured Jev/mock scores. */
export function composeNewsBriefLine(input: {
  urgency: number;
  relevance: number;
  tone: NewsBriefTone;
  query?: string;
  worthDeepDive?: boolean;
  worthGraph?: boolean;
  language?: NewsBriefLanguage;
}): string {
  const language = input.language ?? "en";
  const hasQuery = Boolean(input.query?.trim());
  const parts = [
    urgencyLabel(input.urgency, language),
    relevanceLabel(input.relevance, hasQuery, language),
    toneLabel(input.tone, language),
  ];
  if (input.worthDeepDive) parts.push(language === "vi" ? "Phân tích sâu" : "Deep dive");
  if (input.worthGraph) parts.push(language === "vi" ? "Đồ thị" : "Graph");
  return parts.join(" · ");
}

/** Offline keyword brief when TypeSafe/Jev is unavailable. */
export function mockBriefNewsStory(input: NewsBriefRequest): NewsBriefResult {
  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  const query = (input.query ?? "").trim();
  const blob = `${title} ${excerpt}`;

  let urgency = 0.2;
  if (CRITICAL_RE.test(blob)) urgency = 0.85;
  else if (/\b(today|tonight|this morning|just in)\b/i.test(blob)) urgency = 0.55;

  let relevance = 0.5;
  if (query) {
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const hay = blob.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    relevance = tokens.length === 0 ? 0.5 : clamp01(hits / tokens.length);
  }

  let tone: NewsBriefTone = "neutral";
  if (CAUTION_RE.test(blob) || CRITICAL_RE.test(blob)) tone = "caution";
  else if (OPPORTUNITY_RE.test(blob)) tone = "opportunity";

  let worthDeepDiveScore = 0.35;
  if (urgency >= 0.67 || tone !== "neutral") worthDeepDiveScore = 0.8;
  else if (excerpt.length > 120) worthDeepDiveScore = 0.6;

  let worthGraphScore = 0.3;
  const entityHits = blob.match(new RegExp(ENTITY_RE.source, "g")) ?? [];
  if (entityHits.length >= 3) worthGraphScore = 0.75;
  else if (entityHits.length >= 1) worthGraphScore = 0.55;

  const worthDeepDive = worthDeepDiveScore >= NEWS_TRIAGE_THRESHOLD;
  const worthGraph = worthGraphScore >= NEWS_TRIAGE_THRESHOLD;

  const result: NewsBriefResult = {
    urgency: clamp01(urgency),
    relevance: clamp01(relevance),
    tone,
    worthDeepDive,
    worthDeepDiveScore: clamp01(worthDeepDiveScore),
    worthGraph,
    worthGraphScore: clamp01(worthGraphScore),
    latencyMs: 0,
    questionCount: NEWS_BRIEF_QUESTION_COUNT,
    model: "jev-offline",
    source: "mock",
    line: "",
  };
  result.line = composeNewsBriefLine({
    urgency: result.urgency,
    relevance: result.relevance,
    tone: result.tone,
    query,
    worthDeepDive: result.worthDeepDive,
    worthGraph: result.worthGraph,
    language: input.language ?? "en",
  });
  return result;
}

export function storyTextForBrief(input: NewsBriefRequest): string {
  const title = input.title.trim() || "Untitled";
  const excerpt = input.excerpt.trim();
  return excerpt ? `${title}\n\n${excerpt}` : title;
}
