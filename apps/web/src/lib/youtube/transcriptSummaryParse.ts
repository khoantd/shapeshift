import {
  parseLearningPackLanguage,
  type LearningPackLanguage,
} from "./learningPackParse";

export type TranscriptSummaryLanguage = LearningPackLanguage;

export type TranscriptSummaryRequest = {
  videoId: string;
  title: string;
  channelTitle?: string;
  transcript: string;
  language: TranscriptSummaryLanguage;
  force?: boolean;
  duration?: string;
};

export type TranscriptSummaryParseError = { ok: false; error: string };
export type TranscriptSummaryParseOk = { ok: true; data: TranscriptSummaryRequest };

const TITLE_MAX = 500;
const CHANNEL_MAX = 200;
const TRANSCRIPT_MAX = 100_000;
const VIDEO_ID_RE = /^[\w-]{11}$/;

export function parseTranscriptSummaryRequest(
  body: unknown,
): TranscriptSummaryParseOk | TranscriptSummaryParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected { videoId, title, transcript }" };
  }
  const raw = body as Record<string, unknown>;
  const videoId = typeof raw.videoId === "string" ? raw.videoId.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, TITLE_MAX) : "";
  const channelTitle =
    typeof raw.channelTitle === "string" ? raw.channelTitle.trim().slice(0, CHANNEL_MAX) : "";
  const transcript =
    typeof raw.transcript === "string" ? raw.transcript.replace(/\r\n/g, "\n").trim() : "";
  const language = parseLearningPackLanguage(raw.language) ?? "vi";
  const force = raw.force === true;
  const duration = typeof raw.duration === "string" ? raw.duration.trim().slice(0, 32) : "";

  if (!VIDEO_ID_RE.test(videoId)) {
    return { ok: false, error: "videoId must be an 11-character YouTube id" };
  }
  if (!title) {
    return { ok: false, error: "title required" };
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
      transcript: capped,
      language,
      ...(channelTitle ? { channelTitle } : {}),
      ...(duration ? { duration } : {}),
      ...(force ? { force: true } : {}),
    },
  };
}

export function transcriptSummaryCacheKey(input: TranscriptSummaryRequest): string {
  const t = input.transcript;
  const fingerprint = `${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`;
  return [input.videoId, input.language, fingerprint].join("::");
}

/**
 * Build the Perplexity prompt for a short transcript summary.
 * No web research — transcript is the sole source of truth.
 */
export function buildTranscriptSummaryPrompt(input: TranscriptSummaryRequest): string {
  const lang = input.language === "vi" ? "Vietnamese" : "English";
  const meta = [
    `Title: ${input.title}`,
    input.channelTitle ? `Creator: ${input.channelTitle}` : null,
    input.duration ? `Duration: ${input.duration}` : null,
    `Output language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a study assistant. Summarize this YouTube video transcript in Markdown for a learner who wants a quick recap before deeper study.

${meta}

Rules:
- Fidelity over fabrication: everything must trace to the transcript. Never invent facts.
- Explain in your own words; short attributed quotes only — no long verbatim dumps.
- Write the entire summary in ${lang}.
- Keep it concise: aim for roughly 200–400 words unless the video is very long.
- When the transcript has [mm:ss] markers, cite key moments as [mm:ss] next to the relevant bullet.

Required structure:
1. **TL;DR** — 2–3 sentences capturing the core thesis
2. **Key points** — 5–10 bullet points of the main ideas (include [mm:ss] when available)
3. **Takeaways** — 2–4 non-obvious "so what" points a skimmer would miss

Output ONLY the Markdown summary — no preamble about your process.

--- TRANSCRIPT ---
${input.transcript}
--- END TRANSCRIPT ---`;
}
