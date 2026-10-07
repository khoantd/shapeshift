import { z } from "zod";
import { VIDEO_STUDY_GATE_QUESTION_COUNT } from "./videoStudyGateQuestions";

export const VIDEO_STUDY_DEPTHS = ["short", "standard", "deep"] as const;
export type VideoStudyDepth = (typeof VIDEO_STUDY_DEPTHS)[number];

export const VIDEO_STUDY_AUDIENCES = ["beginner", "intermediate", "advanced"] as const;
export type VideoStudyAudience = (typeof VIDEO_STUDY_AUDIENCES)[number];

export const videoStudyGateRequestSchema = z.object({
  title: z.string().trim().max(500),
  description: z.string().trim().max(4000).optional(),
  channelTitle: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(64).optional(),
  transcriptHead: z.string().trim().max(2000).optional(),
});

export type VideoStudyGateRequest = z.infer<typeof videoStudyGateRequestSchema>;

export type VideoStudyGateResult = {
  depth: VideoStudyDepth;
  audience: VideoStudyAudience;
  packSuitable: boolean;
  packSuitableScore: number;
  line: string;
  latencyMs: number;
  questionCount: number;
  model: string;
  source: "jev" | "mock";
};

const SHORT_RE = /\b(short|#shorts|quick\s+tip|60\s*second|in\s+\d+\s*min|tl;?dr|brief\s+overview)\b/i;
const DEEP_RE =
  /\b(complete\s+course|full\s+course|deep\s+dive|comprehensive|end[- ]to[- ]end|masterclass|advanced\s+patterns|multi[- ]?part)\b/i;
const BEGINNER_RE =
  /\b(beginner|absolute\s+beginners?|intro(duction)?\s+to|no\s+prior|getting\s+started|for\s+newbies)\b/i;
const ADVANCED_RE =
  /\b(advanced|expert|internals|deep\s+dive|speciali[sz]ed|production[- ]grade)\b/i;
const UNSUITABLE_TOPICS = new Set(["entertainment", "music", "other"]);

const PACK_SUITABLE_THRESHOLD = 0.5;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function depthLabel(depth: VideoStudyDepth): string {
  if (depth === "short") return "Short";
  if (depth === "deep") return "Deep";
  return "Standard";
}

function audienceLabel(audience: VideoStudyAudience): string {
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function packLabel(suitable: boolean): string {
  return suitable ? "Pack ready" : "Skip pack";
}

/** Compose a short study-gate line from structured Jev/mock scores. */
export function composeVideoStudyGateLine(input: {
  depth: VideoStudyDepth;
  audience: VideoStudyAudience;
  packSuitable: boolean;
}): string {
  return [
    depthLabel(input.depth),
    audienceLabel(input.audience),
    packLabel(input.packSuitable),
  ].join(" · ");
}

/** Offline keyword gate when TypeSafe/Jev is unavailable. */
export function mockVideoStudyGate(input: VideoStudyGateRequest): VideoStudyGateResult {
  const title = input.title.trim();
  const description = (input.description ?? "").trim();
  const channel = (input.channelTitle ?? "").trim();
  const topic = (input.topic ?? "").trim().toLowerCase();
  const head = (input.transcriptHead ?? "").trim();
  const blob = `${title} ${description} ${channel} ${head}`;

  let depth: VideoStudyDepth = "standard";
  if (SHORT_RE.test(blob)) depth = "short";
  else if (DEEP_RE.test(blob)) depth = "deep";

  let audience: VideoStudyAudience = "intermediate";
  if (BEGINNER_RE.test(blob)) audience = "beginner";
  else if (ADVANCED_RE.test(blob) || depth === "deep") audience = "advanced";

  let packSuitableScore = 0.75;
  if (UNSUITABLE_TOPICS.has(topic) || /\b(prank|comedy|reaction|funny|vlog)\b/i.test(blob)) {
    packSuitableScore = 0.15;
  } else if (/\b(tutorial|lecture|course|explained|how\s*to|documentary)\b/i.test(blob)) {
    packSuitableScore = 0.9;
  }

  const packSuitable = packSuitableScore >= PACK_SUITABLE_THRESHOLD;
  const result: VideoStudyGateResult = {
    depth,
    audience,
    packSuitable,
    packSuitableScore: clamp01(packSuitableScore),
    latencyMs: 0,
    questionCount: VIDEO_STUDY_GATE_QUESTION_COUNT,
    model: "jev-offline",
    source: "mock",
    line: "",
  };
  result.line = composeVideoStudyGateLine({
    depth: result.depth,
    audience: result.audience,
    packSuitable: result.packSuitable,
  });
  return result;
}

export function videoTextForStudyGate(input: VideoStudyGateRequest): string {
  const title = input.title.trim() || "Untitled";
  const description = (input.description ?? "").trim();
  const channel = (input.channelTitle ?? "").trim();
  const topic = (input.topic ?? "").trim();
  const head = (input.transcriptHead ?? "").trim();
  const parts = [title];
  if (channel) parts.push(`Channel: ${channel}`);
  if (topic) parts.push(`Content type: ${topic}`);
  if (description) parts.push(description);
  if (head) parts.push(`Transcript excerpt:\n${head}`);
  return parts.join("\n\n");
}

export { PACK_SUITABLE_THRESHOLD };
