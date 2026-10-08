import "server-only";

import { LRU } from "@shapeshift/core";
import {
  getObjectBuffer,
  getSignedObjectUrl,
  hasMinioConfig,
  headObject,
  MinioConfigError,
  MISSING_MINIO_MESSAGE,
  objectExists,
  putObject,
} from "@/lib/minio/client";
import { resolveNarrationDurationSeconds } from "./mp3Duration";
import {
  runGithubRepoExplainer,
  RepoExplainerConfigError,
  RepoExplainerUpstreamError,
} from "./repoExplainer";
import type { RepoExplainerChapter } from "./repoExplainerParse";
import {
  renderRepoExplainerMp4,
  RepoVideoRenderError,
} from "./repoVideoRender";
import {
  estimateSpeechDurationSeconds,
  parseRepoVideoRequest,
  videoAudioObjectKey,
  videoContentHash,
  videoObjectKey,
  videoPlaybackProxyPath,
  type RepoVideoRequest,
} from "./repoVideoParse";
import {
  durationSecondsFromAudioBytes,
  planChapterAudioResume,
} from "./repoVideoResume";
import {
  hasOpenAiApiKey,
  MISSING_OPENAI_MESSAGE,
  narrateChapter,
  type ChapterNarration,
  RepoVideoTtsConfigError,
  RepoVideoTtsUpstreamError,
} from "./repoVideoTts";

export {
  parseRepoVideoRequest,
  videoAudioObjectKey,
  videoContentHash,
  videoObjectKey,
  videoPlaybackProxyPath,
  estimateSpeechDurationSeconds,
  contentFingerprint,
} from "./repoVideoParse";

export type {
  RepoVideoRequest,
  RepoVideoLanguage,
} from "./repoVideoParse";

export {
  RepoVideoTtsConfigError,
  RepoVideoTtsUpstreamError,
  RepoVideoRenderError,
  MinioConfigError,
  RepoExplainerConfigError,
  RepoExplainerUpstreamError,
};

export type RepoVideoResult = {
  fullName: string;
  language: string;
  contentHash: string;
  objectKey: string;
  url: string;
  /** True when final MP4 was already in storage */
  cached: boolean;
  /** How many chapter mp3s were reused from MinIO (skipped TTS) */
  resumedAudioCount: number;
  chapters: RepoExplainerChapter[];
};

export type RepoVideoStatus =
  | { status: "missing" }
  | {
      status: "ready";
      url: string;
      objectKey: string;
      contentHash: string;
    };

const resultCache = new LRU<string, RepoVideoResult>(20);

function cacheKey(fullName: string, language: string, hash: string): string {
  return `${fullName}::${language}::${hash}`;
}

export function assertVideoDepsConfigured(): void {
  if (!hasMinioConfig()) {
    throw new MinioConfigError(MISSING_MINIO_MESSAGE);
  }
  if (!hasOpenAiApiKey()) {
    throw new RepoVideoTtsConfigError(MISSING_OPENAI_MESSAGE);
  }
}

export async function lookupRepoVideo(input: {
  fullName: string;
  language: string;
  chapters: RepoExplainerChapter[];
}): Promise<RepoVideoStatus> {
  assertVideoDepsConfigured();
  const contentHash = videoContentHash({
    fullName: input.fullName,
    language: input.language as RepoVideoRequest["language"],
    chapters: input.chapters,
  });
  const objectKey = videoObjectKey({
    fullName: input.fullName,
    language: input.language as RepoVideoRequest["language"],
    contentHash,
  });
  const exists = await objectExists(objectKey);
  if (!exists) return { status: "missing" };
  return {
    status: "ready",
    url: videoPlaybackProxyPath({
      fullName: input.fullName,
      language: input.language as RepoVideoRequest["language"],
      contentHash,
    }),
    objectKey,
    contentHash,
  };
}

export async function runGithubRepoVideo(
  input: RepoVideoRequest,
  signal?: AbortSignal,
): Promise<RepoVideoResult> {
  assertVideoDepsConfigured();

  const explainer = await runGithubRepoExplainer(
    {
      fullName: input.fullName,
      description: input.description,
      readme: input.readme,
      treeOutline: input.treeOutline,
      language: input.language,
      force: input.force,
    },
    signal,
  );
  signal?.throwIfAborted();

  const chapters = explainer.chapters;
  if (chapters.length < 2) {
    throw new RepoVideoTtsUpstreamError(
      "Need at least two chapters to generate video",
      422,
    );
  }
  const contentHash = videoContentHash({
    fullName: input.fullName,
    language: input.language,
    chapters,
  });
  const objectKey = videoObjectKey({
    fullName: input.fullName,
    language: input.language,
    contentHash,
  });
  const memKey = cacheKey(input.fullName, input.language, contentHash);

  const playbackUrl = videoPlaybackProxyPath({
    fullName: input.fullName,
    language: input.language,
    contentHash,
  });

  if (!input.force) {
    const mem = resultCache.get(memKey);
    if (mem) return { ...mem, url: playbackUrl, cached: true };
    if (await objectExists(objectKey)) {
      const hit: RepoVideoResult = {
        fullName: input.fullName,
        language: input.language,
        contentHash,
        objectKey,
        url: playbackUrl,
        cached: true,
        resumedAudioCount: chapters.length,
        chapters,
      };
      resultCache.set(memKey, hit);
      return hit;
    }
  }

  // Resume: reuse chapter mp3s already in MinIO; only TTS missing ones.
  const audioKeys = chapters.map((_, chapterIndex) =>
    videoAudioObjectKey({
      fullName: input.fullName,
      language: input.language,
      contentHash,
      chapterIndex,
    }),
  );
  const heads = await Promise.all(audioKeys.map((key) => headObject(key)));
  const plan = planChapterAudioResume({
    chapterCount: chapters.length,
    existingFlags: heads.map((h) => h.exists),
    force: input.force,
  });

  const narrations: ChapterNarration[] = [];
  const audioUrls: string[] = [];

  for (let i = 0; i < chapters.length; i++) {
    signal?.throwIfAborted();
    const chapter = chapters[i]!;
    const key = audioKeys[i]!;

    if (plan.toReuse.includes(i)) {
      const text = `${chapter.title}. ${chapter.body}`;
      let audio: Buffer = Buffer.alloc(0);
      try {
        audio = await getObjectBuffer(key);
      } catch {
        /* fall through to estimate */
      }
      let durationSeconds = resolveNarrationDurationSeconds({
        audio,
        text,
        estimateSpeechDurationSeconds,
      });
      if (audio.length === 0) {
        const byBytes = durationSecondsFromAudioBytes(
          heads[i]!.contentLength ?? 0,
        );
        durationSeconds = Math.max(
          1.2,
          Math.min(45, (byBytes + durationSeconds) / 2),
        );
      }
      narrations[i] = {
        title: chapter.title,
        body: chapter.body,
        audio: Buffer.alloc(0),
        durationSeconds,
      };
      audioUrls[i] = await getSignedObjectUrl(key, 7200);
      continue;
    }

    const narration = await narrateChapter(chapter, signal);
    await putObject({
      key,
      body: narration.audio,
      contentType: "audio/mpeg",
    });
    narrations[i] = narration;
    audioUrls[i] = await getSignedObjectUrl(key, 7200);
  }

  const mp4 = await renderRepoExplainerMp4({
    fullName: input.fullName,
    description: input.description,
    narrations,
    audioUrls,
  });

  signal?.throwIfAborted();
  await putObject({
    key: objectKey,
    body: mp4,
    contentType: "video/mp4",
  });

  const result: RepoVideoResult = {
    fullName: input.fullName,
    language: input.language,
    contentHash,
    objectKey,
    url: playbackUrl,
    cached: false,
    resumedAudioCount: plan.toReuse.length,
    chapters,
  };
  resultCache.set(memKey, result);
  return result;
}

export async function getRepoVideoPlaybackUrl(input: {
  fullName: string;
  language: RepoVideoRequest["language"];
  contentHash?: string;
}): Promise<RepoVideoStatus> {
  assertVideoDepsConfigured();
  if (input.contentHash) {
    const objectKey = videoObjectKey({
      fullName: input.fullName,
      language: input.language,
      contentHash: input.contentHash,
    });
    if (!(await objectExists(objectKey))) return { status: "missing" };
    return {
      status: "ready",
      url: videoPlaybackProxyPath({
        fullName: input.fullName,
        language: input.language,
        contentHash: input.contentHash,
      }),
      objectKey,
      contentHash: input.contentHash,
    };
  }
  // Without a hash, list is not available cheaply — client should POST to generate
  // or pass contentHash from a prior generate response.
  return { status: "missing" };
}
