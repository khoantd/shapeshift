import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const LIST_LIMIT = 200;
const linkType = v.union(
  v.literal("RELATED_TO"),
  v.literal("SUPPORTS"),
  v.literal("CONTRASTS_WITH"),
);

export const create = mutation({
  args: {
    googleSub: v.string(),
    sourceNodeKey: v.string(),
    targetNodeKey: v.string(),
    type: linkType,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const sourceNodeKey = args.sourceNodeKey.trim().slice(0, 128);
    const targetNodeKey = args.targetNodeKey.trim().slice(0, 128);
    if (!sourceNodeKey || !targetNodeKey) throw new Error("endpoints required");
    if (sourceNodeKey === targetNodeKey) throw new Error("endpoints must differ");

    const existing = await ctx.db
      .query("newsKnowledgeLinks")
      .withIndex("by_googleSub_endpoints", (q) =>
        q
          .eq("googleSub", googleSub)
          .eq("sourceNodeKey", sourceNodeKey)
          .eq("targetNodeKey", targetNodeKey)
          .eq("type", args.type),
      )
      .unique();

    if (existing) {
      if (args.note !== undefined) {
        await ctx.db.patch(existing._id, {
          note: args.note.trim().slice(0, 500) || undefined,
        });
      }
      return { id: existing._id };
    }

    const id = await ctx.db.insert("newsKnowledgeLinks", {
      googleSub,
      sourceNodeKey,
      targetNodeKey,
      type: args.type,
      ...(args.note?.trim()
        ? { note: args.note.trim().slice(0, 500) }
        : {}),
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const remove = mutation({
  args: {
    id: v.id("newsKnowledgeLinks"),
    googleSub: v.string(),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const row = await ctx.db.get(args.id);
    if (!row || row.googleSub !== googleSub) {
      throw new Error("link not found");
    }
    await ctx.db.delete(args.id);
    return { ok: true };
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
      .query("newsKnowledgeLinks")
      .withIndex("by_googleSub_createdAt", (q) => q.eq("googleSub", googleSub))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      sourceNodeKey: row.sourceNodeKey,
      targetNodeKey: row.targetNodeKey,
      type: row.type,
      note: row.note ?? null,
      createdAt: row.createdAt,
    }));
  },
});
