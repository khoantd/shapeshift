import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MARKDOWN_MAX = 200_000;
const TRANSCRIPT_MAX = 100_000;
const LIST_LIMIT = 50;

export const save = mutation({
  args: {
    googleSub: v.string(),
    email: v.optional(v.string()),
    videoId: v.string(),
    videoTitle: v.string(),
    channelTitle: v.optional(v.string()),
    markdown: v.string(),
    transcript: v.optional(v.string()),
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

    const id = await ctx.db.insert("youtubeLearningPacks", {
      googleSub,
      ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
      videoId,
      videoTitle: args.videoTitle.trim().slice(0, 500) || "Untitled",
      ...(args.channelTitle
        ? { channelTitle: args.channelTitle.trim().slice(0, 200) }
        : {}),
      markdown,
      ...(transcript ? { transcript } : {}),
      createdAt: Date.now(),
    });
    return { id };
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
      videoTitle: row.videoTitle,
      channelTitle: row.channelTitle ?? null,
      markdown: row.markdown,
      transcript: row.transcript ?? null,
      createdAt: row.createdAt,
    }));
  },
});
