import { z } from "zod";

export const NEWS_BRIEF_TONES = ["neutral", "caution", "opportunity"] as const;
export type NewsBriefTone = (typeof NEWS_BRIEF_TONES)[number];

export const newsBriefRequestSchema = z.object({
  title: z.string().trim().max(500),
  excerpt: z.string().trim().max(4000),
  query: z.string().trim().max(200).optional(),
});

export type NewsBriefRequest = z.infer<typeof newsBriefRequestSchema>;

export type NewsBriefResult = {
  urgency: number;
  relevance: number;
  tone: NewsBriefTone;
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

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function urgencyLabel(score: number): string {
  if (score >= 0.67) return "Urgent";
  if (score >= 0.34) return "Time-sensitive";
  return "Low urgency";
}

function relevanceLabel(score: number, hasQuery: boolean): string {
  if (!hasQuery) return "General";
  if (score >= 0.67) return "Highly relevant";
  if (score >= 0.34) return "Somewhat relevant";
  return "Low relevance";
}

function toneLabel(tone: NewsBriefTone): string {
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
}): string {
  const hasQuery = Boolean(input.query?.trim());
  return [
    urgencyLabel(input.urgency),
    relevanceLabel(input.relevance, hasQuery),
    toneLabel(input.tone),
  ].join(" · ");
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

  const result = {
    urgency: clamp01(urgency),
    relevance: clamp01(relevance),
    tone,
    latencyMs: 0,
    questionCount: 3,
    model: "jev-offline",
    source: "mock" as const,
    line: "",
  };
  result.line = composeNewsBriefLine({
    urgency: result.urgency,
    relevance: result.relevance,
    tone: result.tone,
    query,
  });
  return result;
}

export function storyTextForBrief(input: NewsBriefRequest): string {
  const title = input.title.trim() || "Untitled";
  const excerpt = input.excerpt.trim();
  return excerpt ? `${title}\n\n${excerpt}` : title;
}
