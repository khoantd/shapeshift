import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const SUMMARY_MAX = 100_000;
const TRANSCRIPT_MAX = 100_000;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export const upsert = mutation({
  args: {
    googleSub: v.string(),
    email: v.optional(v.string()),
    videoId: v.string(),
    videoTitle: v.string(),
    channelTitle: v.optional(v.string()),
    language: v.union(v.literal("vi"), v.literal("en")),
    markdown: v.string(),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const videoId = args.videoId.trim();
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error("invalid videoId");

    const markdown = clip(args.markdown.trim(), SUMMARY_MAX);
    if (!markdown) throw new Error("markdown required");

    const transcriptRaw = args.transcript?.replace(/\r\n/g, "\n").trim() ?? "";
    const transcript = transcriptRaw ? clip(transcriptRaw, TRANSCRIPT_MAX) : "";

    const now = Date.now();
    const existing = await ctx.db
      .query("youtubeTranscriptSummaries")
      .withIndex("by_googleSub_videoId", (q) =>
        q.eq("googleSub", googleSub).eq("videoId", videoId),
      )
      .unique();

    const langPatch =
      args.language === "vi" ? { summaryVi: markdown } : { summaryEn: markdown };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...langPatch,
        videoTitle: args.videoTitle.trim().slice(0, 500) || existing.videoTitle,
        ...(args.channelTitle
          ? { channelTitle: args.channelTitle.trim().slice(0, 200) }
          : {}),
        ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
        ...(transcript ? { transcript } : {}),
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("youtubeTranscriptSummaries", {
      googleSub,
      ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
      videoId,
      videoTitle: args.videoTitle.trim().slice(0, 500) || "Untitled",
      ...(args.channelTitle
        ? { channelTitle: args.channelTitle.trim().slice(0, 200) }
        : {}),
      ...langPatch,
      ...(transcript ? { transcript } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const getByVideo = query({
  args: {
    googleSub: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    const videoId = args.videoId.trim();
    if (!googleSub || !/^[\w-]{11}$/.test(videoId)) return null;

    const row = await ctx.db
      .query("youtubeTranscriptSummaries")
      .withIndex("by_googleSub_videoId", (q) =>
        q.eq("googleSub", googleSub).eq("videoId", videoId),
      )
      .unique();

    if (!row) return null;

    return {
      id: row._id,
      videoId: row.videoId,
      videoTitle: row.videoTitle,
      channelTitle: row.channelTitle ?? null,
      summaryVi: row.summaryVi ?? null,
      summaryEn: row.summaryEn ?? null,
      transcript: row.transcript ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
});
