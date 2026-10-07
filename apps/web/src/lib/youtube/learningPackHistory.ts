import "server-only";

import { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  summarizeLearningPackStats,
  type LearningPackHistoryStats,
} from "@/lib/youtube/learningPackHistoryStats";
import { shouldRetryLearningPackSaveWithoutExtras } from "@/lib/youtube/learningPackSaveRetry";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function asGraphPayload(raw: unknown): GraphPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) return null;
  return { nodes: obj.nodes as GraphPayload["nodes"], links: obj.links as GraphPayload["links"] };
}

export type LearningPackHistoryItem = {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoTitle: string;
  channelTitle: string | null;
  contentType: string | null;
  conceptCount: number;
  termCount: number;
  markdown: string;
  transcript: string | null;
  graphPayload: GraphPayload | null;
  createdAt: number;
};

export type HistoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export type SaveHistoryResult =
  | { ok: true; id: string; persistedExtras: boolean }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

function withStats(row: {
  id: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string | null;
  contentType?: string | null;
  markdown: string;
  transcript: string | null;
  graphPayload: GraphPayload | null;
  createdAt: number;
}): LearningPackHistoryItem {
  const stats: LearningPackHistoryStats = summarizeLearningPackStats({
    markdown: row.markdown,
    graphPayload: row.graphPayload,
    contentType: row.contentType,
  });
  return {
    id: row.id,
    videoId: row.videoId,
    videoUrl: youtubeWatchUrl(row.videoId),
    thumbnailUrl: youtubeThumbnailUrl(row.videoId),
    videoTitle: row.videoTitle,
    channelTitle: row.channelTitle,
    contentType: stats.contentType,
    conceptCount: stats.conceptCount,
    termCount: stats.termCount,
    markdown: row.markdown,
    transcript: row.transcript,
    graphPayload: row.graphPayload,
    createdAt: row.createdAt,
  };
}

type SaveMutationArgs = {
  googleSub: string;
  email?: string;
  videoId: string;
  videoTitle: string;
  channelTitle?: string;
  contentType?: string;
  markdown: string;
  transcript?: string;
  graphPayload?: { nodes: GraphPayload["nodes"]; links: GraphPayload["links"] };
};

function buildSaveMutationArgs(
  input: {
    googleSub: string;
    email?: string | null;
    videoId: string;
    videoTitle: string;
    channelTitle?: string | null;
    contentType?: string | null;
    markdown: string;
    transcript?: string | null;
    graphPayload?: GraphPayload | null;
  },
  extras: boolean,
): SaveMutationArgs {
  const args: SaveMutationArgs = {
    googleSub: input.googleSub,
    videoId: input.videoId,
    videoTitle: input.videoTitle,
    markdown: input.markdown,
  };
  if (input.email) args.email = input.email;
  if (input.channelTitle) args.channelTitle = input.channelTitle;
  if (input.transcript?.trim()) {
    args.transcript = input.transcript.replace(/\r\n/g, "\n").trim();
  }
  if (extras) {
    if (input.contentType) args.contentType = input.contentType;
    if (input.graphPayload) {
      args.graphPayload = {
        nodes: input.graphPayload.nodes,
        links: input.graphPayload.links,
      };
    }
  }
  return args;
}

export async function saveLearningPackHistory(input: {
  googleSub: string;
  email?: string | null;
  videoId: string;
  videoTitle: string;
  channelTitle?: string | null;
  contentType?: string | null;
  markdown: string;
  transcript?: string | null;
  graphPayload?: GraphPayload | null;
}): Promise<SaveHistoryResult> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }

  const wantsExtras = Boolean(input.contentType || input.graphPayload);
  try {
    const row = await c.mutation(
      api.youtubeLearningPacks.save,
      buildSaveMutationArgs(input, true),
    );
    return { ok: true, id: String(row.id), persistedExtras: wantsExtras };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (wantsExtras && shouldRetryLearningPackSaveWithoutExtras(message)) {
      try {
        const row = await c.mutation(
          api.youtubeLearningPacks.save,
          buildSaveMutationArgs(input, false),
        );
        console.warn(
          `[youtube-learning-packs] saved without contentType/graphPayload (deployment may need \`npx convex dev\`): ${message}`,
        );
        return { ok: true, id: String(row.id), persistedExtras: false };
      } catch (retryErr) {
        const retryMessage =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.warn(`[youtube-learning-packs] save retry failed: ${retryMessage}`);
        return {
          ok: false,
          reason: "upstream",
          message:
            "Could not save history. If you just updated this feature, run `npx convex dev` in apps/web.",
        };
      }
    }
    console.warn(`[youtube-learning-packs] save failed: ${message}`);
    return {
      ok: false,
      reason: "upstream",
      message:
        "Could not save history. If you just updated this feature, run `npx convex dev` in apps/web.",
    };
  }
}

export async function updateLearningPackGraphPayload(input: {
  id: string;
  googleSub: string;
  graphPayload: GraphPayload;
}): Promise<boolean> {
  const c = client();
  if (!c) return false;
  try {
    await c.mutation(api.youtubeLearningPacks.updateGraphPayload, {
      id: input.id as Id<"youtubeLearningPacks">,
      googleSub: input.googleSub,
      graphPayload: {
        nodes: input.graphPayload.nodes,
        links: input.graphPayload.links,
      },
    });
    return true;
  } catch (err) {
    console.warn(
      `[youtube-learning-packs] updateGraphPayload failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
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
      data: rows.map((row) =>
        withStats({
          id: String(row.id),
          videoId: row.videoId,
          videoTitle: row.videoTitle,
          channelTitle: row.channelTitle,
          contentType: row.contentType ?? null,
          markdown: row.markdown,
          transcript: row.transcript ?? null,
          graphPayload: asGraphPayload(row.graphPayload),
          createdAt: row.createdAt,
        }),
      ),
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
