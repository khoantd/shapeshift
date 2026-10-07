import "server-only";
import { APIUserAbortError, TypeSafeClient } from "@typesafe-ai/sdk";
import { questions, QUESTION_COUNT } from "./questions";
import { newsBriefQuestions, NEWS_BRIEF_QUESTION_COUNT } from "./newsBriefQuestions";
import {
  composeNewsBriefLine,
  storyTextForBrief,
  type NewsBriefRequest,
  type NewsBriefResult,
  type NewsBriefTone,
  NEWS_TRIAGE_THRESHOLD,
} from "./newsBrief";
import {
  composeVideoClassifyLine,
  FLAG_THRESHOLD,
  videoTextForClassify,
  type VideoBriefTone,
  type VideoClassifyRequest,
  type VideoClassifyResult,
  type VideoTopic,
} from "./videoClassify";
import { videoClassifyQuestions, VIDEO_CLASSIFY_QUESTION_COUNT } from "./videoClassifyQuestions";
import {
  composeNewsLinkSuggestLine,
  newsLinkTextForSuggest,
  type NewsLinkSuggestRequest,
  type NewsLinkSuggestResult,
  type NewsLinkType,
} from "./newsLinkSuggest";
import {
  newsLinkSuggestQuestions,
  NEWS_LINK_SUGGEST_QUESTION_COUNT,
} from "./newsLinkSuggestQuestions";
import {
  composeVideoStudyGateLine,
  videoTextForStudyGate,
  type VideoStudyAudience,
  type VideoStudyDepth,
  type VideoStudyGateRequest,
  type VideoStudyGateResult,
  PACK_SUITABLE_THRESHOLD,
} from "./videoStudyGate";
import {
  videoStudyGateQuestions,
  VIDEO_STUDY_GATE_QUESTION_COUNT,
} from "./videoStudyGateQuestions";
import type { Answer, IntentResult } from "./types";

let client: TypeSafeClient | null = null;
let warned = false;

/** A real-looking key: not empty and not a copied placeholder like "sk-..." or "your-key-here". */
export function looksLikeKey(key: string | undefined): key is string {
  const k = key?.trim() ?? "";
  return k.length >= 12 && !/\.\.\.|your|xxx|placeholder|changeme|<|>/i.test(k);
}

/**
 * Offline by default. The online Jev model is used only when a real API key is set,
 * and NEXT_PUBLIC_USE_MOCK=true can still force offline for UI work and demos.
 */
export function classifierMode(): { mode: "online" | "offline"; reason: string } {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return { mode: "offline", reason: "NEXT_PUBLIC_USE_MOCK=true" };
  if (!looksLikeKey(process.env.TYPESAFE_API_KEY)) return { mode: "offline", reason: "no TYPESAFE_API_KEY set" };
  return { mode: "online", reason: `using ${process.env.JEV_MODEL || "jev-latest"}` };
}

export function warnMockOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.info(`[shapeshift] Offline classifier (jev-offline): ${reason}. Add a TypeSafe key to .env.local to go online.`);
}

function getClient() {
  if (!client) {
    client = new TypeSafeClient({
      defaultModel: process.env.JEV_MODEL || "jev-latest",
      // One fast attempt: a stale answer is worse than falling back to the mock.
      retry: { maxRetries: 0 },
      timeout: 2500,
    });
  }
  return client;
}

function answer<T extends string>(r: { choice: T; confidence: number; probabilities: { readonly [k in T]: number } }): Answer<T> {
  return { value: r.choice, confidence: r.confidence, probabilities: { ...r.probabilities } as Partial<Record<T, number>> };
}

/** One call, every question in parallel. Throws on network / API errors. */
export async function classifyWithJev(text: string, signal?: AbortSignal): Promise<IntentResult> {
  const started = performance.now();
  const res = await getClient().systemOne({ state: { text }, questions }, { signal });
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;

  return {
    intent: answer(a.intent),
    readiness: a.readiness.score,
    signals: {
      isQuestion: a.isQuestion.noul,
      recurring: a.recurring.noul,
      urgency: { score: a.urgency.score, confidence: a.urgency.confidence },
      tone: answer(a.tone),
      eventMode: answer(a.eventMode),
      transport: answer(a.transport),
      tripType: answer(a.tripType),
      expenseCategory: answer(a.expenseCategory),
      colorMood: answer(a.colorMood),
      timerKind: answer(a.timerKind),
      hasExplicitOptions: a.hasExplicitOptions.noul,
      isShoppingList: a.isShoppingList.noul,
      ticketPriority: { score: a.ticketPriority.score, confidence: a.ticketPriority.confidence },
      docCategory: answer(a.docCategory),
      needsModeration: a.needsModeration.noul,
      answerQuality: { score: a.answerQuality.score, confidence: a.answerQuality.confidence },
      needsRevision: a.needsRevision.noul,
      routeDecision: answer(a.routeDecision),
      toolApproval: answer(a.toolApproval),
    },
    latencyMs,
    questionCount: QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

/** Brief a news story with a small Jev question set. Throws on network / API errors. */
export async function briefNewsStoryWithJev(
  input: NewsBriefRequest,
  signal?: AbortSignal,
): Promise<NewsBriefResult> {
  const started = performance.now();
  const text = storyTextForBrief(input);
  const query = (input.query ?? "").trim();
  const res = await getClient().systemOne(
    { state: { text, query }, questions: newsBriefQuestions },
    { signal },
  );
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;
  const urgency = a.urgency.score;
  const relevance = a.relevance.score;
  const tone = a.tone.choice as NewsBriefTone;
  const worthDeepDiveScore = a.worthDeepDive.noul;
  const worthGraphScore = a.worthGraph.noul;
  const worthDeepDive = worthDeepDiveScore >= NEWS_TRIAGE_THRESHOLD;
  const worthGraph = worthGraphScore >= NEWS_TRIAGE_THRESHOLD;

  return {
    urgency,
    relevance,
    tone,
    worthDeepDive,
    worthDeepDiveScore,
    worthGraph,
    worthGraphScore,
    line: composeNewsBriefLine({
      urgency,
      relevance,
      tone,
      query,
      worthDeepDive,
      worthGraph,
      language: input.language ?? "en",
    }),
    latencyMs,
    questionCount: NEWS_BRIEF_QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

/** Classify a YouTube video with a small Jev question set. Throws on network / API errors. */
export async function classifyVideoWithJev(
  input: VideoClassifyRequest,
  signal?: AbortSignal,
): Promise<VideoClassifyResult> {
  const started = performance.now();
  const text = videoTextForClassify(input);
  const query = (input.query ?? "").trim();
  const res = await getClient().systemOne(
    { state: { text, query }, questions: videoClassifyQuestions },
    { signal },
  );
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;
  const topic = a.topic.choice as VideoTopic;
  const needsModeration = a.needsModeration.noul;
  const urgency = a.urgency.score;
  const relevance = a.relevance.score;
  const tone = a.tone.choice as VideoBriefTone;
  const flagged = needsModeration >= FLAG_THRESHOLD;

  return {
    topic,
    needsModeration,
    flagged,
    urgency,
    relevance,
    tone,
    line: composeVideoClassifyLine({ topic, flagged, urgency, relevance, tone, query }),
    latencyMs,
    questionCount: VIDEO_CLASSIFY_QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

/** Suggest a knowledge-graph edge type between two news entities. Throws on network / API errors. */
export async function suggestNewsLinkWithJev(
  input: NewsLinkSuggestRequest,
  signal?: AbortSignal,
): Promise<NewsLinkSuggestResult> {
  const started = performance.now();
  const text = newsLinkTextForSuggest(input);
  const res = await getClient().systemOne(
    { state: { text }, questions: newsLinkSuggestQuestions },
    { signal },
  );
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;
  const linkType = a.linkType.choice as NewsLinkType;
  const confidence = a.confidence.score;

  return {
    linkType,
    confidence,
    line: composeNewsLinkSuggestLine({ linkType, confidence }),
    latencyMs,
    questionCount: NEWS_LINK_SUGGEST_QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

/** Gate study-pack depth/audience before generative pack creation. Throws on network / API errors. */
export async function gateVideoStudyWithJev(
  input: VideoStudyGateRequest,
  signal?: AbortSignal,
): Promise<VideoStudyGateResult> {
  const started = performance.now();
  const text = videoTextForStudyGate(input);
  const res = await getClient().systemOne(
    { state: { text }, questions: videoStudyGateQuestions },
    { signal },
  );
  const latencyMs = Math.round(performance.now() - started);
  const a = res.answers;
  const depth = a.depth.choice as VideoStudyDepth;
  const audience = a.audience.choice as VideoStudyAudience;
  const packSuitableScore = a.packSuitable.noul;
  const packSuitable = packSuitableScore >= PACK_SUITABLE_THRESHOLD;

  return {
    depth,
    audience,
    packSuitable,
    packSuitableScore,
    line: composeVideoStudyGateLine({ depth, audience, packSuitable }),
    latencyMs,
    questionCount: VIDEO_STUDY_GATE_QUESTION_COUNT,
    model: res.model,
    source: "jev",
  };
}

export { APIUserAbortError };
