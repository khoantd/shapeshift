export type LearningPackLanguage = "vi" | "en";

export const LEARNING_PACK_CONTENT_TYPES = [
  "tutorial",
  "lecture",
  "talk",
  "documentary",
  "review",
] as const;

export type LearningPackContentType = (typeof LEARNING_PACK_CONTENT_TYPES)[number];

export const LEARNING_PACK_DEPTHS = ["short", "standard", "deep"] as const;
export type LearningPackDepth = (typeof LEARNING_PACK_DEPTHS)[number];

export const LEARNING_PACK_AUDIENCES = ["beginner", "intermediate", "advanced"] as const;
export type LearningPackAudience = (typeof LEARNING_PACK_AUDIENCES)[number];

export type LearningPackRequest = {
  videoId: string;
  title: string;
  channelTitle?: string;
  contentType: LearningPackContentType;
  transcript: string;
  language?: LearningPackLanguage;
  force?: boolean;
  duration?: string;
  /** Optional Jev study-gate depth (injected server-side when absent). */
  depth?: LearningPackDepth;
  /** Optional Jev study-gate audience (injected server-side when absent). */
  audience?: LearningPackAudience;
};

export type LearningPackParseError = { ok: false; error: string };
export type LearningPackParseOk = { ok: true; data: LearningPackRequest };

const TITLE_MAX = 500;
const CHANNEL_MAX = 200;
const TRANSCRIPT_MAX = 100_000;
const VIDEO_ID_RE = /^[\w-]{11}$/;

const CONTENT_TYPE_SET = new Set<string>(LEARNING_PACK_CONTENT_TYPES);
const DEPTH_SET = new Set<string>(LEARNING_PACK_DEPTHS);
const AUDIENCE_SET = new Set<string>(LEARNING_PACK_AUDIENCES);

export function parseLearningPackLanguage(raw: unknown): LearningPackLanguage | null {
  if (raw === "vi" || raw === "en") return raw;
  return null;
}

export function parseLearningPackContentType(raw: unknown): LearningPackContentType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  // Legacy Jev labels → skill types
  if (t === "how-to") return "tutorial";
  if (t === "education") return "lecture";
  if (t === "news") return "review";
  if (CONTENT_TYPE_SET.has(t)) return t as LearningPackContentType;
  return null;
}

export function parseLearningPackDepth(raw: unknown): LearningPackDepth | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return DEPTH_SET.has(t) ? (t as LearningPackDepth) : null;
}

export function parseLearningPackAudience(raw: unknown): LearningPackAudience | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return AUDIENCE_SET.has(t) ? (t as LearningPackAudience) : null;
}

/** Map any VideoTopic (including entertainment/music/other) to a pack content type. */
export function resolvePackContentType(topic: string | null | undefined): LearningPackContentType {
  const parsed = parseLearningPackContentType(topic);
  if (parsed) return parsed;
  return "lecture";
}

export function parseLearningPackRequest(body: unknown): LearningPackParseOk | LearningPackParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { videoId, title, contentType, transcript }" };
  }
  const raw = body as Record<string, unknown>;
  const videoId = typeof raw.videoId === "string" ? raw.videoId.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, TITLE_MAX) : "";
  const channelTitle =
    typeof raw.channelTitle === "string" ? raw.channelTitle.trim().slice(0, CHANNEL_MAX) : "";
  const transcript =
    typeof raw.transcript === "string" ? raw.transcript.replace(/\r\n/g, "\n").trim() : "";
  const contentType = parseLearningPackContentType(raw.contentType);
  const language = parseLearningPackLanguage(raw.language) ?? "en";
  const force = raw.force === true;
  const duration = typeof raw.duration === "string" ? raw.duration.trim().slice(0, 32) : "";
  const depth = parseLearningPackDepth(raw.depth) ?? undefined;
  const audience = parseLearningPackAudience(raw.audience) ?? undefined;

  if (!VIDEO_ID_RE.test(videoId)) {
    return { ok: false, error: "videoId must be an 11-character YouTube id" };
  }
  if (!title) {
    return { ok: false, error: "title required" };
  }
  if (!contentType) {
    return {
      ok: false,
      error: `contentType must be one of: ${LEARNING_PACK_CONTENT_TYPES.join(", ")}`,
    };
  }
  if (transcript.length < 80) {
    return { ok: false, error: "transcript too short — paste more of the spoken content" };
  }

  const capped =
    transcript.length > TRANSCRIPT_MAX
      ? transcript.slice(0, TRANSCRIPT_MAX) +
        "\n\n[Transcript truncated — remaining content omitted for length.]"
      : transcript;

  return {
    ok: true,
    data: {
      videoId,
      title,
      contentType,
      transcript: capped,
      language,
      ...(channelTitle ? { channelTitle } : {}),
      ...(duration ? { duration } : {}),
      ...(depth ? { depth } : {}),
      ...(audience ? { audience } : {}),
      ...(force ? { force: true } : {}),
    },
  };
}

export function learningPackCacheKey(input: LearningPackRequest): string {
  const t = input.transcript;
  // Hash-ish: length + head/tail so we don't store huge keys
  const fingerprint = `${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`;
  return [
    input.videoId,
    input.contentType,
    input.language ?? "en",
    input.depth ?? "auto",
    input.audience ?? "auto",
    fingerprint,
  ].join("::");
}

const CONTENT_EMPHASIS: Record<LearningPackContentType, string> = {
  tutorial:
    "Emphasize steps, commands, checklists, and a 'do this yourself' walkthrough. Concepts are secondary to procedure.",
  lecture:
    "Emphasize concepts, definitions, mental models, and cause-and-effect. A concept map helps.",
  talk: "Emphasize arguments, claims, stories, the speaker's thesis and supporting evidence; capture nuance.",
  documentary: "Emphasize timeline, actors, what happened and why it matters.",
  review: "Emphasize claims vs evidence, criteria used, verdict, and assertion vs fact.",
};

const DEPTH_GUIDANCE: Record<LearningPackDepth, string> = {
  short: "Keep the pack tight (one-pager scale). Prefer fewer concepts and a short quiz.",
  standard: "Use a full multi-section study pack scaled to the material.",
  deep: "Produce a thorough multi-module guide; do not crush dense material.",
};

const AUDIENCE_GUIDANCE: Record<LearningPackAudience, string> = {
  beginner: "Assume a motivated beginner — define jargon and pace gently.",
  intermediate: "Assume some background — skip ultra-basic primers.",
  advanced: "Assume experienced learners — keep specialist depth and nuance.",
};

/**
 * Build the Perplexity prompt for a study-ready Markdown learning pack.
 * No web research — transcript is the sole source of truth.
 */
export function buildLearningPackPrompt(input: LearningPackRequest): string {
  const lang = input.language === "vi" ? "Vietnamese" : "English";
  const depth = input.depth ?? "standard";
  const audience = input.audience ?? "intermediate";
  const meta = [
    `Title: ${input.title}`,
    input.channelTitle ? `Creator: ${input.channelTitle}` : null,
    input.duration ? `Duration: ${input.duration}` : null,
    `Content type: ${input.contentType}`,
    `Study depth: ${depth}`,
    `Audience: ${audience}`,
    `Output language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an instructional designer. Turn this YouTube video transcript into a study-ready learning pack in Markdown.

${meta}

Content-type emphasis: ${CONTENT_EMPHASIS[input.contentType]}
Depth guidance: ${DEPTH_GUIDANCE[depth]}
Audience guidance: ${AUDIENCE_GUIDANCE[audience]}

Rules:
- Fidelity over fabrication: everything must trace to the transcript. Never invent facts.
- Explain in your own words; short attributed quotes only — no long verbatim dumps.
- Include every section below that has real substance; omit a section rather than padding.
- Scale depth to the material (short video → tight one-pager; long lecture → fuller guide).
- Write the entire pack in ${lang}.
- When the transcript has [mm:ss] markers, every key concept MUST include **Revisit:** [mm:ss] (cite the moment the idea is explained).
- Flag contested or likely outdated claims rather than presenting them as settled fact.

Required section order (omit empty ones):
1. Header & orientation — title, creator, duration; TL;DR (2–3 sentences); Who this is for; What you'll be able to do after
2. Key concepts — 3–10 ideas; each with plain-language explanation, why it matters, and **Revisit:** [mm:ss] when the transcript is timestamped
3. Insights & takeaways — non-obvious "so what" points
4. Structured notes — thematic chunks (not a timestamp dump)
5. Glossary — one-line definitions (skip if none)
6. Worked example / walkthrough (tutorials) OR Key arguments (talks) — choose by content type
7. Check your understanding — 5–10 questions (recall→apply→analyze) then an Answer key
8. Flashcards — 8–20 atomic pairs as "- Q: … | A: …"
9. Apply it — concrete next actions or reflection
10. Go deeper — next topics / search terms (no invented URLs)

Output ONLY the Markdown learning pack — no preamble about your process.

--- TRANSCRIPT ---
${input.transcript}
--- END TRANSCRIPT ---`;
}
