import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MARKDOWN_MAX = 200_000;
const TRANSCRIPT_MAX = 100_000;
const LIST_LIMIT = 50;

const graphPayloadValidator = v.object({
  nodes: v.array(v.any()),
  links: v.array(v.any()),
});

function mapPackRow(row: {
  _id: string;
  videoId: string;
  videoTitle: string;
  channelTitle?: string;
  contentType?: string;
  markdown: string;
  transcript?: string;
  graphPayload?: { nodes: unknown[]; links: unknown[] };
  createdAt: number;
  updatedAt?: number;
}) {
  return {
    id: row._id,
    videoId: row.videoId,
    videoUrl: `https://www.youtube.com/watch?v=${row.videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
    videoTitle: row.videoTitle,
    channelTitle: row.channelTitle ?? null,
    contentType: row.contentType ?? null,
    markdown: row.markdown,
    transcript: row.transcript ?? null,
    graphPayload: row.graphPayload ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

/** Upsert one pack per (googleSub, videoId); delete older duplicates for that pair. */
export const save = mutation({
  args: {
    googleSub: v.string(),
    email: v.optional(v.string()),
    videoId: v.string(),
    videoTitle: v.string(),
    channelTitle: v.optional(v.string()),
    contentType: v.optional(v.string()),
    markdown: v.string(),
    transcript: v.optional(v.string()),
    graphPayload: v.optional(graphPayloadValidator),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const videoId = args.videoId.trim();
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error("invalid videoId");
    const markdown =
      args.markdown.length > MARKDOWN_MAX
        ? args.markdown.slice(0, MARKDOWN_MAX)
        : args.markdown;
    if (!markdown.trim()) throw new Error("markdown required");

    const transcriptRaw = args.transcript?.replace(/\r\n/g, "\n").trim() ?? "";
    const transcript =
      transcriptRaw.length > TRANSCRIPT_MAX
        ? transcriptRaw.slice(0, TRANSCRIPT_MAX)
        : transcriptRaw;

    const contentType = args.contentType?.trim().slice(0, 64) || undefined;
    const now = Date.now();
    const videoTitle = args.videoTitle.trim().slice(0, 500) || "Untitled";

    const existing = await ctx.db
      .query("youtubeLearningPacks")
      .withIndex("by_googleSub_videoId", (q) =>
        q.eq("googleSub", googleSub).eq("videoId", videoId),
      )
      .collect();

    existing.sort((a, b) => b.createdAt - a.createdAt);
    const keep = existing[0];
    const dupes = existing.slice(1);

    const fields = {
      ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
      videoTitle,
      ...(args.channelTitle
        ? { channelTitle: args.channelTitle.trim().slice(0, 200) }
        : {}),
      ...(contentType ? { contentType } : {}),
      markdown,
      ...(transcript ? { transcript } : {}),
      ...(args.graphPayload ? { graphPayload: args.graphPayload } : {}),
      updatedAt: now,
    };

    if (keep) {
      await ctx.db.patch(keep._id, fields);
      for (const dupe of dupes) {
        await ctx.db.delete(dupe._id);
      }
      return { id: keep._id, created: false };
    }

    const id = await ctx.db.insert("youtubeLearningPacks", {
      googleSub,
      videoId,
      ...fields,
      createdAt: now,
    });
    return { id, created: true };
  },
});

export const updateGraphPayload = mutation({
  args: {
    id: v.id("youtubeLearningPacks"),
    googleSub: v.string(),
    graphPayload: graphPayloadValidator,
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");

    const row = await ctx.db.get(args.id);
    if (!row || row.googleSub !== googleSub) {
      throw new Error("pack not found");
    }

    await ctx.db.patch(args.id, {
      graphPayload: args.graphPayload,
      updatedAt: Date.now(),
    });
    return { id: args.id };
  },
});

export const getByUserVideo = query({
  args: {
    googleSub: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    const videoId = args.videoId.trim();
    if (!googleSub || !/^[\w-]{11}$/.test(videoId)) return null;

    const rows = await ctx.db
      .query("youtubeLearningPacks")
      .withIndex("by_googleSub_videoId", (q) =>
        q.eq("googleSub", googleSub).eq("videoId", videoId),
      )
      .collect();

    if (rows.length === 0) return null;
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return mapPackRow(rows[0]!);
  },
});

export const listByUser = query({
  args: {
    googleSub: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) return [];
    const limit = Math.min(Math.max(args.limit ?? LIST_LIMIT, 1), LIST_LIMIT);

    // Fetch extra rows so we can hide historical duplicates for the same videoId.
    const rows = await ctx.db
      .query("youtubeLearningPacks")
      .withIndex("by_googleSub_createdAt", (q) => q.eq("googleSub", googleSub))
      .order("desc")
      .take(Math.min(limit * 4, 200));

    const seen = new Set<string>();
    const out: ReturnType<typeof mapPackRow>[] = [];
    for (const row of rows) {
      if (seen.has(row.videoId)) continue;
      seen.add(row.videoId);
      out.push(mapPackRow(row));
      if (out.length >= limit) break;
    }
    return out;
  },
});
