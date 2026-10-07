import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEEP_DIVE_MAX = 200_000;
const LIST_LIMIT = 50;

const graphPayloadValidator = v.object({
  nodes: v.array(v.any()),
  links: v.array(v.any()),
});

export const upsert = mutation({
  args: {
    googleSub: v.string(),
    email: v.optional(v.string()),
    storyId: v.string(),
    title: v.string(),
    canonicalUrl: v.string(),
    deepDiveText: v.optional(v.string()),
    graphPayload: graphPayloadValidator,
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const storyId = args.storyId.trim().slice(0, 200);
    if (!storyId) throw new Error("storyId required");

    const deepDiveRaw = args.deepDiveText?.replace(/\r\n/g, "\n").trim() ?? "";
    const deepDiveText =
      deepDiveRaw.length > DEEP_DIVE_MAX
        ? deepDiveRaw.slice(0, DEEP_DIVE_MAX)
        : deepDiveRaw;

    const now = Date.now();
    const existing = await ctx.db
      .query("newsKnowledgeArticles")
      .withIndex("by_googleSub_storyId", (q) =>
        q.eq("googleSub", googleSub).eq("storyId", storyId),
      )
      .unique();

    const fields = {
      ...(args.email ? { email: args.email.trim().slice(0, 200) } : {}),
      title: args.title.trim().slice(0, 500) || "Untitled",
      canonicalUrl: args.canonicalUrl.trim().slice(0, 2000),
      ...(deepDiveText ? { deepDiveText } : {}),
      graphPayload: args.graphPayload,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { id: existing._id };
    }

    const id = await ctx.db.insert("newsKnowledgeArticles", {
      googleSub,
      storyId,
      ...fields,
      createdAt: now,
    });
    return { id };
  },
});

export const getByStory = query({
  args: {
    googleSub: v.string(),
    storyId: v.string(),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    const storyId = args.storyId.trim();
    if (!googleSub || !storyId) return null;

    const row = await ctx.db
      .query("newsKnowledgeArticles")
      .withIndex("by_googleSub_storyId", (q) =>
        q.eq("googleSub", googleSub).eq("storyId", storyId),
      )
      .unique();

    if (!row) return null;
    return {
      id: row._id,
      storyId: row.storyId,
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      deepDiveText: row.deepDiveText ?? null,
      graphPayload: row.graphPayload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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
      .query("newsKnowledgeArticles")
      .withIndex("by_googleSub_updatedAt", (q) => q.eq("googleSub", googleSub))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      storyId: row.storyId,
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      deepDiveText: row.deepDiveText ?? null,
      graphPayload: row.graphPayload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});
