import { z } from "zod";
import { VIDEO_CLASSIFY_QUESTION_COUNT } from "./videoClassifyQuestions";

/** Skill-aligned content types + residual non-study buckets. */
export const VIDEO_TOPICS = [
  "tutorial",
  "lecture",
  "talk",
  "documentary",
  "review",
  "entertainment",
  "music",
  "other",
] as const;
export type VideoTopic = (typeof VIDEO_TOPICS)[number];

/** Topics that suit a learning-pack generation flow. */
export const LEARNING_PACK_TOPICS = [
  "tutorial",
  "lecture",
  "talk",
  "documentary",
  "review",
] as const;
export type LearningPackTopic = (typeof LEARNING_PACK_TOPICS)[number];

export const VIDEO_BRIEF_TONES = ["neutral", "caution", "opportunity"] as const;
export type VideoBriefTone = (typeof VIDEO_BRIEF_TONES)[number];

export const videoClassifyRequestSchema = z.object({
  title: z.string().trim().max(500),
  description: z.string().trim().max(4000),
  query: z.string().trim().max(200).optional(),
  channelTitle: z.string().trim().max(200).optional(),
});

export type VideoClassifyRequest = z.infer<typeof videoClassifyRequestSchema>;

export type VideoClassifyResult = {
  topic: VideoTopic;
  needsModeration: number;
  flagged: boolean;
  urgency: number;
  relevance: number;
  tone: VideoBriefTone;
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
const FLAG_RE =
  /\b(nsfw|explicit|gore|hate|violence|terror|scam|phishing|nude|porn)\b/i;

const TUTORIAL_RE =
  /\b(how\s*to|diy|step[- ]by[- ]step|recipe|walkthrough|guide|install|setup|coding\s+tutorial)\b/i;
const LECTURE_RE =
  /\b(lecture|course|lesson|learn|class|explained|curriculum|academic|explainer)\b/i;
const TALK_RE =
  /\b(keynote|interview|podcast|ted\s*talk|panel|fireside|conversation\s+with)\b/i;
const DOCUMENTARY_RE =
  /\b(documentary|case\s+study|investigation|what\s+happened|behind\s+the\s+story)\b/i;
const REVIEW_RE =
  /\b(review|opinion|critique|verdict|news|headline|breaking|coverage|press\s+conference)\b/i;
const MUSIC_RE =
  /\b(official\s+video|music\s+video|lyrics|song|album|concert|remix|feat\.?)\b/i;
const ENTERTAINMENT_RE =
  /\b(vlog|comedy|reaction|funny|prank|challenge|trailer)\b/i;

const FLAG_THRESHOLD = 0.5;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function topicLabel(topic: VideoTopic): string {
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function safetyLabel(flagged: boolean): string {
  return flagged ? "Flag" : "OK";
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

function toneLabel(tone: VideoBriefTone): string {
  if (tone === "caution") return "Cautionary tone";
  if (tone === "opportunity") return "Opportunity tone";
  return "Neutral tone";
}

/** Compose a short classification line from structured Jev/mock scores. */
export function composeVideoClassifyLine(input: {
  topic: VideoTopic;
  flagged: boolean;
  urgency: number;
  relevance: number;
  tone: VideoBriefTone;
  query?: string;
}): string {
  const hasQuery = Boolean(input.query?.trim());
  return [
    topicLabel(input.topic),
    safetyLabel(input.flagged),
    urgencyLabel(input.urgency),
    relevanceLabel(input.relevance, hasQuery),
    toneLabel(input.tone),
  ].join(" · ");
}

function inferTopic(blob: string): VideoTopic {
  if (TUTORIAL_RE.test(blob)) return "tutorial";
  if (MUSIC_RE.test(blob)) return "music";
  if (DOCUMENTARY_RE.test(blob)) return "documentary";
  if (TALK_RE.test(blob)) return "talk";
  if (REVIEW_RE.test(blob)) return "review";
  if (LECTURE_RE.test(blob)) return "lecture";
  if (ENTERTAINMENT_RE.test(blob)) return "entertainment";
  return "other";
}

/** Offline keyword classifier when TypeSafe/Jev is unavailable. */
export function mockClassifyVideo(input: VideoClassifyRequest): VideoClassifyResult {
  const title = input.title.trim();
  const description = input.description.trim();
  const query = (input.query ?? "").trim();
  const channel = (input.channelTitle ?? "").trim();
  const blob = `${title} ${description} ${channel}`;

  const topic = inferTopic(blob);

  let needsModeration = 0.1;
  if (FLAG_RE.test(blob)) needsModeration = 0.9;
  else if (/\b(controversial|sensitive|graphic)\b/i.test(blob)) needsModeration = 0.55;

  let urgency = 0.2;
  if (CRITICAL_RE.test(blob)) urgency = 0.85;
  else if (/\b(today|tonight|this morning|just\s+dropped|premiere)\b/i.test(blob)) urgency = 0.55;

  let relevance = 0.5;
  if (query) {
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const hay = blob.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    relevance = tokens.length === 0 ? 0.5 : clamp01(hits / tokens.length);
  }

  let tone: VideoBriefTone = "neutral";
  if (CAUTION_RE.test(blob) || CRITICAL_RE.test(blob)) tone = "caution";
  else if (OPPORTUNITY_RE.test(blob)) tone = "opportunity";

  const flagged = needsModeration >= FLAG_THRESHOLD;
  const result: VideoClassifyResult = {
    topic,
    needsModeration: clamp01(needsModeration),
    flagged,
    urgency: clamp01(urgency),
    relevance: clamp01(relevance),
    tone,
    latencyMs: 0,
    questionCount: VIDEO_CLASSIFY_QUESTION_COUNT,
    model: "jev-offline",
    source: "mock",
    line: "",
  };
  result.line = composeVideoClassifyLine({
    topic: result.topic,
    flagged: result.flagged,
    urgency: result.urgency,
    relevance: result.relevance,
    tone: result.tone,
    query,
  });
  return result;
}

export function videoTextForClassify(input: VideoClassifyRequest): string {
  const title = input.title.trim() || "Untitled";
  const description = input.description.trim();
  const channel = (input.channelTitle ?? "").trim();
  const parts = [title];
  if (channel) parts.push(`Channel: ${channel}`);
  if (description) parts.push(description);
  return parts.join("\n\n");
}

export { FLAG_THRESHOLD };
