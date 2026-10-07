import { Suspense } from "react";
import type { NewsFeedItem } from "@shapeshift/react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteChrome } from "@/components/SiteChrome";
import { NewsPageClient } from "@/components/NewsPageClient";
import {
  resolveInspiredCanvasAuth,
} from "@/lib/inspired-canvas/auth";
import {
  InspiredCanvasClientError,
  getInspiredCanvasBaseUrl,
  listCxoFeed,
} from "@/lib/inspired-canvas/client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("News");
  return {
    title: t("title"),
    description: t("description"),
  };
}

async function loadFeed(source?: string): Promise<{
  items: NewsFeedItem[];
  sourceNames: string[];
  error: string | null;
}> {
  const { token, error: authError } = await resolveInspiredCanvasAuth();
  if (!token) {
    return {
      items: [],
      sourceNames: [],
      error: authError,
    };
  }
  try {
    const feed = await listCxoFeed({
      baseUrl: getInspiredCanvasBaseUrl(),
      accessToken: token,
      limit: 50,
      source: source || undefined,
    });
    return {
      items: feed.items,
      sourceNames: feed.sources.map((s) => s.displayName),
      error: null,
    };
  } catch (e) {
    if (e instanceof InspiredCanvasClientError) {
      return { items: [], sourceNames: [], error: e.message };
    }
    return {
      items: [],
      sourceNames: [],
      error: e instanceof Error ? e.message : "Inspired Canvas unreachable",
    };
  }
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("News");
  const params = searchParams ? await searchParams : {};
  const sourceRaw = params.source;
  const source = typeof sourceRaw === "string" ? sourceRaw.trim() : "";
  const { items, sourceNames, error } = await loadFeed(source);

  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl px-4 py-16 text-[15px] text-muted-foreground">
            {t("loading")}
          </div>
        }
      >
        <NewsPageClient
          initialItems={items}
          initialSourceNames={sourceNames}
          initialError={error}
        />
      </Suspense>
      <SiteChrome />
    </>
  );
}
