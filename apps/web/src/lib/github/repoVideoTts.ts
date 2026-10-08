import "server-only";

import OpenAI from "openai";
import type { RepoExplainerChapter } from "./repoExplainerParse";
import { resolveNarrationDurationSeconds } from "./mp3Duration";
import { estimateSpeechDurationSeconds } from "./repoVideoParse";

export class RepoVideoTtsConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "RepoVideoTtsConfigError";
  }
}

export class RepoVideoTtsUpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "RepoVideoTtsUpstreamError";
    this.status = status;
  }
}

export const MISSING_OPENAI_MESSAGE =
  "OPENAI_API_KEY is not set. Create a key at https://platform.openai.com/api-keys for narrated video TTS.";

export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type ChapterNarration = {
  title: string;
  body: string;
  audio: Buffer;
  durationSeconds: number;
};

const VOICE = "onyx" as const;
const MODEL = "tts-1" as const;

export async function narrateChapter(
  chapter: RepoExplainerChapter,
  signal?: AbortSignal,
): Promise<ChapterNarration> {
  if (!hasOpenAiApiKey()) {
    throw new RepoVideoTtsConfigError(MISSING_OPENAI_MESSAGE);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = `${chapter.title}. ${chapter.body}`;
  try {
    const response = await client.audio.speech.create(
      {
        model: MODEL,
        voice: VOICE,
        input: text.slice(0, 4000),
        response_format: "mp3",
      },
      { signal },
    );
    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const durationSeconds = resolveNarrationDurationSeconds({
      audio,
      text,
      estimateSpeechDurationSeconds,
    });
    return {
      title: chapter.title,
      body: chapter.body,
      audio,
      durationSeconds,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    const message =
      err instanceof Error ? err.message : "OpenAI TTS request failed";
    throw new RepoVideoTtsUpstreamError(message, 502);
  }
}

export async function narrateChapters(
  chapters: RepoExplainerChapter[],
  signal?: AbortSignal,
): Promise<ChapterNarration[]> {
  if (chapters.length < 2) {
    throw new RepoVideoTtsUpstreamError(
      "Need at least two chapters to narrate",
      422,
    );
  }
  const out: ChapterNarration[] = [];
  for (const chapter of chapters) {
    signal?.throwIfAborted();
    out.push(await narrateChapter(chapter, signal));
  }
  return out;
}
