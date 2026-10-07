import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MARKDOWN_MAX = 200_000;
const TRANSCRIPT_MAX = 100_000;
const LIST_LIMIT = 50;

const graphPayloadValidator = v.object({
  nodes: v.array(v.any()),
  links: v.array(v.any()),
});

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

    const id = await ctx.db.insert("youtubeLearningPacks", {
      googleSub,
      ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
      videoId,
      videoTitle: args.videoTitle.trim().slice(0, 500) || "Untitled",
      ...(args.channelTitle
        ? { channelTitle: args.channelTitle.trim().slice(0, 200) }
        : {}),
      ...(contentType ? { contentType } : {}),
      markdown,
      ...(transcript ? { transcript } : {}),
      ...(args.graphPayload ? { graphPayload: args.graphPayload } : {}),
      createdAt: Date.now(),
    });
    return { id };
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

    await ctx.db.patch(args.id, { graphPayload: args.graphPayload });
    return { id: args.id };
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

    const rows = await ctx.db
      .query("youtubeLearningPacks")
      .withIndex("by_googleSub_createdAt", (q) => q.eq("googleSub", googleSub))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
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
    }));
  },
});
