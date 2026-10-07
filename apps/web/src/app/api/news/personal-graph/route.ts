import { NextRequest, NextResponse } from "next/server";
import {
  applyGoogleOAuthCookies,
  ensureGoogleOAuthIdentity,
} from "@/lib/auth/googleIdentity";
import {
  compareArticleOverlap,
  mergePersonalKnowledgeGraph,
} from "@/lib/news/personalKnowledgeMerge";
import {
  listNewsKnowledgeArticles,
  listNewsKnowledgeLinks,
  toUserKnowledgeLinks,
} from "@/lib/news/newsKnowledgeHistory";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ensured = await ensureGoogleOAuthIdentity(request);
  if (!ensured.identity) {
    const res = NextResponse.json({
      success: true,
      signedIn: false,
      articles: [],
      links: [],
      graph: null,
      overlap: null,
    });
    if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    return res;
  }

  const googleSub = ensured.identity.sub;
  const compareA = request.nextUrl.searchParams.get("compareA")?.trim() ?? "";
  const compareB = request.nextUrl.searchParams.get("compareB")?.trim() ?? "";

  const [articlesResult, linksResult] = await Promise.all([
    listNewsKnowledgeArticles(googleSub),
    listNewsKnowledgeLinks(googleSub),
  ]);

  if (!articlesResult.ok) {
    const res = NextResponse.json(
      { success: false, error: articlesResult.message, signedIn: true },
      { status: 502 },
    );
    if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    return res;
  }
  if (!linksResult.ok) {
    const res = NextResponse.json(
      { success: false, error: linksResult.message, signedIn: true },
      { status: 502 },
    );
    if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
    return res;
  }

  const articles = articlesResult.data;
  const links = linksResult.data;
  const graph = mergePersonalKnowledgeGraph(
    articles.map((a) => a.graphPayload),
    toUserKnowledgeLinks(links),
  );

  let overlap: ReturnType<typeof compareArticleOverlap> | null = null;
  if (compareA && compareB && compareA !== compareB) {
    const ga = articles.find((a) => a.storyId === compareA)?.graphPayload;
    const gb = articles.find((a) => a.storyId === compareB)?.graphPayload;
    if (ga && gb) overlap = compareArticleOverlap(ga, gb);
  }

  const res = NextResponse.json({
    success: true,
    signedIn: true,
    articles: articles.map((a) => ({
      id: a.id,
      storyId: a.storyId,
      title: a.title,
      canonicalUrl: a.canonicalUrl,
      nodeCount: a.graphPayload.nodes.length,
      linkCount: a.graphPayload.links.length,
      updatedAt: a.updatedAt,
    })),
    links: links.map((l) => ({
      id: l.id,
      sourceNodeKey: l.sourceNodeKey,
      targetNodeKey: l.targetNodeKey,
      type: l.type,
      note: l.note,
      createdAt: l.createdAt,
    })),
    graph,
    overlap,
  });
  if (ensured.cookiesToSet) applyGoogleOAuthCookies(res, ensured.cookiesToSet);
  return res;
}
