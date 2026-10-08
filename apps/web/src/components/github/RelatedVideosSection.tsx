"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2, PlaySquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  buildRelatedVideosQuery,
  youtubeBridgeHref,
} from "@/lib/github/relatedVideosQuery";
import type { GithubRepoCard } from "@/lib/github/types";
import type { YouTubeVideo } from "@/lib/youtube/types";

type State =
  | { status: "idle" | "loading" }
  | { status: "ready"; videos: YouTubeVideo[]; q: string }
  | { status: "empty"; q: string }
  | { status: "error"; message: string; q: string; unavailable?: boolean };

export function RelatedVideosSection({ repo }: { repo: GithubRepoCard }) {
  const t = useTranslations("GitHub");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const q = buildRelatedVideosQuery({
      fullName: repo.fullName,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
    });
    const ac = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        const body = (await res.json()) as {
          success?: boolean;
          videos?: YouTubeVideo[];
          error?: { message?: string; code?: string } | string;
        };
        if (ac.signal.aborted) return;
        if (res.status === 503) {
          setState({
            status: "error",
            message: t("relatedVideosUnavailable"),
            q,
            unavailable: true,
          });
          return;
        }
        if (!res.ok || !body.success) {
          const msg =
            typeof body.error === "string"
              ? body.error
              : body.error?.message || t("errorRelatedVideos");
          setState({ status: "error", message: msg, q });
          return;
        }
        const videos = (body.videos ?? []).slice(0, 5);
        if (videos.length === 0) {
          setState({ status: "empty", q });
          return;
        }
        setState({ status: "ready", videos, q });
      } catch (e) {
        if (ac.signal.aborted) return;
        setState({
          status: "error",
          message:
            e instanceof Error ? e.message : t("errorRelatedVideos"),
          q,
        });
      }
    })();

    return () => ac.abort();
  }, [
    repo.fullName,
    repo.name,
    repo.description,
    repo.language,
    // topics array identity changes; join for stable deps
    repo.topics.join(","),
    t,
  ]);

  const searchQ =
    state.status === "ready" ||
    state.status === "empty" ||
    state.status === "error"
      ? state.q
      : buildRelatedVideosQuery({
          fullName: repo.fullName,
          name: repo.name,
          language: repo.language,
          topics: repo.topics,
        });

  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-5"
      aria-label={t("relatedVideos")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          <PlaySquare className="size-3.5" aria-hidden />
          {t("relatedVideos")}
        </h2>
        <Link
          href={youtubeBridgeHref({ q: searchQ })}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("searchOnYouTube")}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>

      {state.status === "loading" ? (
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("loadingRelatedVideos")}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-[13px] text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "empty" ? (
        <p className="text-[13px] text-muted-foreground">
          {t("noRelatedVideos")}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <ul className="flex flex-col gap-2">
          {state.videos.map((v) => (
            <li key={v.videoId}>
              <Link
                href={youtubeBridgeHref({ q: state.q, videoId: v.videoId })}
                className="group flex cursor-pointer gap-3 rounded-md border border-border bg-background/60 p-2 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbs
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    width={120}
                    height={68}
                    className="h-[68px] w-[120px] shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-[68px] w-[120px] shrink-0 items-center justify-center rounded-md bg-muted">
                    <PlaySquare className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="line-clamp-2 text-[13px] font-medium text-foreground group-hover:underline">
                    {v.title}
                  </p>
                  {v.channelTitle ? (
                    <p className="mt-1 truncate text-[12px] text-muted-foreground">
                      {v.channelTitle}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
