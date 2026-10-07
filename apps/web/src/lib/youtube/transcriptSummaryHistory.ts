import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { LearningPackLanguage } from "@/lib/youtube/learningPackParse";

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export type TranscriptSummaryHistory = {
  id: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string | null;
  summaryVi: string | null;
  summaryEn: string | null;
  transcript: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SummaryHistoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export type SaveSummaryHistoryResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export async function saveTranscriptSummaryHistory(input: {
  googleSub: string;
  email?: string | null;
  videoId: string;
  videoTitle: string;
  channelTitle?: string | null;
  language: LearningPackLanguage;
  markdown: string;
  transcript?: string | null;
}): Promise<SaveSummaryHistoryResult> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }

  try {
    const row = await c.mutation(api.youtubeTranscriptSummaries.upsert, {
      googleSub: input.googleSub,
      videoId: input.videoId,
      videoTitle: input.videoTitle,
      language: input.language,
      markdown: input.markdown,
      ...(input.email ? { email: input.email } : {}),
      ...(input.channelTitle ? { channelTitle: input.channelTitle } : {}),
      ...(input.transcript?.trim()
        ? { transcript: input.transcript.replace(/\r\n/g, "\n").trim() }
        : {}),
    });
    return { ok: true, id: String(row.id), created: row.created };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[youtube-transcript-summaries] save failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not save summary. If you just added this feature, run `npx convex dev` in apps/web.",
    };
  }
}

export async function getTranscriptSummaryHistory(
  googleSub: string,
  videoId: string,
): Promise<SummaryHistoryResult<TranscriptSummaryHistory | null>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }

  try {
    const row = await c.query(api.youtubeTranscriptSummaries.getByVideo, {
      googleSub,
      videoId,
    });
    if (!row) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        id: String(row.id),
        videoId: row.videoId,
        videoTitle: row.videoTitle,
        channelTitle: row.channelTitle,
        summaryVi: row.summaryVi,
        summaryEn: row.summaryEn,
        transcript: row.transcript,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[youtube-transcript-summaries] get failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not load summary. If you just added this feature, run `npx convex dev` in apps/web.",
    };
  }
}
