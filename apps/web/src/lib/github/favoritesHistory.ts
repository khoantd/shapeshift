import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { normalizeFavoriteTopics } from "./topics";

function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export type FavoritesResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "upstream"; message: string };

export type GithubFavoritesData = {
  topics: string[];
  updatedAt: number | null;
};

export async function getGithubFavorites(
  googleSub: string,
): Promise<FavoritesResult<GithubFavoritesData>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  try {
    const row = await c.query(api.githubFavorites.getByUser, {
      googleSub,
    });
    if (!row) {
      return { ok: true, data: { topics: [], updatedAt: null } };
    }
    return {
      ok: true,
      data: {
        topics: normalizeFavoriteTopics(row.topics),
        updatedAt: row.updatedAt,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "upstream",
      message: e instanceof Error ? e.message : "Failed to load favorites",
    };
  }
}

export async function saveGithubFavorites(input: {
  googleSub: string;
  email?: string | null;
  topics: readonly string[];
}): Promise<FavoritesResult<GithubFavoritesData>> {
  const c = client();
  if (!c) {
    return {
      ok: false,
      reason: "not_configured",
      message: "History store is not configured (set NEXT_PUBLIC_CONVEX_URL)",
    };
  }
  const topics = normalizeFavoriteTopics(input.topics);
  try {
    const row = await c.mutation(api.githubFavorites.upsertTopics, {
      googleSub: input.googleSub,
      ...(input.email ? { email: input.email } : {}),
      topics,
    });
    return {
      ok: true,
      data: {
        topics: normalizeFavoriteTopics(row.topics),
        updatedAt: row.updatedAt,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "upstream",
      message: e instanceof Error ? e.message : "Failed to save favorites",
    };
  }
}
