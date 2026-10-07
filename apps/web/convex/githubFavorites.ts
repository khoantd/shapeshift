import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_TOPICS = 12;
const TOPIC_ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

function sanitizeTopics(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = item.trim().toLowerCase();
    if (!TOPIC_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

export const getByUser = query({
  args: { googleSub: v.string() },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) return null;
    const row = await ctx.db
      .query("githubFavorites")
      .withIndex("by_googleSub", (q) => q.eq("googleSub", googleSub))
      .unique();
    if (!row) return null;
    return {
      id: row._id,
      topics: row.topics,
      updatedAt: row.updatedAt,
      email: row.email ?? null,
    };
  },
});

export const upsertTopics = mutation({
  args: {
    googleSub: v.string(),
    email: v.optional(v.string()),
    topics: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const googleSub = args.googleSub.trim();
    if (!googleSub) throw new Error("googleSub required");
    const topics = sanitizeTopics(args.topics);
    const now = Date.now();
    const existing = await ctx.db
      .query("githubFavorites")
      .withIndex("by_googleSub", (q) => q.eq("googleSub", googleSub))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        topics,
        updatedAt: now,
        ...(args.email
          ? { email: args.email.trim().slice(0, 200) }
          : {}),
      });
      return { id: existing._id, topics, updatedAt: now };
    }

    const id = await ctx.db.insert("githubFavorites", {
      googleSub,
      ...(args.email
        ? { email: args.email.trim().slice(0, 200) }
        : {}),
      topics,
      updatedAt: now,
    });
    return { id, topics, updatedAt: now };
  },
});
