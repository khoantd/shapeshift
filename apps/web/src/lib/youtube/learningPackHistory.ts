import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { youtubeWatchUrl } from "@/lib/youtube/url";

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export type LearningPackHistoryItem = {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  channelTitle: string | null;
  markdown: string;
  transcript: string | null;
  createdAt: number;
};

export type HistoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export async function saveLearningPackHistory(input: {
  googleSub: string;
  email?: string | null;
  videoId: string;
  videoTitle: string;
  channelTitle?: string | null;
  markdown: string;
  transcript?: string | null;
}): Promise<{ id: string } | null> {
  const c = client();
  if (!c) return null;
  try {
    return await c.mutation(api.youtubeLearningPacks.save, {
      googleSub: input.googleSub,
      ...(input.email ? { email: input.email } : {}),
      videoId: input.videoId,
      videoTitle: input.videoTitle,
      ...(input.channelTitle ? { channelTitle: input.channelTitle } : {}),
      markdown: input.markdown,
      ...(input.transcript?.trim()
        ? { transcript: input.transcript.replace(/\r\n/g, "\n").trim() }
        : {}),
    });
  } catch (err) {
    console.warn(
      `[youtube-learning-packs] save failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

export async function listLearningPackHistory(
  googleSub: string,
  limit = 50,
): Promise<HistoryResult<LearningPackHistoryItem[]>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const rows = await c.query(api.youtubeLearningPacks.listByUser, {
      googleSub,
      limit,
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: String(row.id),
        videoId: row.videoId,
        videoUrl: youtubeWatchUrl(row.videoId),
        videoTitle: row.videoTitle,
        channelTitle: row.channelTitle,
        markdown: row.markdown,
        transcript: row.transcript ?? null,
        createdAt: row.createdAt,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[youtube-learning-packs] list failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not load history. If you just added this feature, run `npx convex dev` in apps/web.",
    };
  }
}
