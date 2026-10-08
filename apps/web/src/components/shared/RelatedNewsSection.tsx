"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2, Newspaper } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { NewsFeedItem } from "@shapeshift/react";
import type { GithubRepoCard } from "@/lib/github/types";
import {
  buildRelatedNewsFromRepoQuery,
  buildRelatedNewsFromVideoQuery,
  newsBridgeHref,
} from "@/lib/news/relatedNewsQuery";

type State =
  | { status: "idle" | "loading" }
  | { status: "ready"; items: NewsFeedItem[]; q: string }
  | { status: "empty"; q: string }
  | { status: "error"; message: string; q: string; unauthorized?: boolean };

type RelatedNewsSectionProps =
  | { source: "repo"; repo: GithubRepoCard; namespace?: "GitHub" | "YouTube" }
  | {
      source: "video";
      title: string;
      channelTitle?: string | null;
      topicLabel?: string | null;
      namespace?: "GitHub" | "YouTube";
    };

function buildQuery(props: RelatedNewsSectionProps): string {
  if (props.source === "repo") {
    return buildRelatedNewsFromRepoQuery({
      fullName: props.repo.fullName,
      name: props.repo.name,
      description: props.repo.description,
      language: props.repo.language,
      topics: props.repo.topics,
    });
  }
  return buildRelatedNewsFromVideoQuery({
    title: props.title,
    channelTitle: props.channelTitle,
    topicLabel: props.topicLabel,
  });
}

export function RelatedNewsSection(props: RelatedNewsSectionProps) {
  const ns = props.namespace ?? (props.source === "repo" ? "GitHub" : "YouTube");
  const t = useTranslations(ns);
  const [state, setState] = useState<State>({ status: "loading" });

  const depKey =
    props.source === "repo"
      ? `${props.repo.fullName}|${props.repo.topics.join(",")}|${props.repo.language ?? ""}`
      : `${props.title}|${props.channelTitle ?? ""}|${props.topicLabel ?? ""}`;

  useEffect(() => {
    const q = buildQuery(props);
    const ac = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(
          `/api/news?q=${encodeURIComponent(q)}&limit=50`,
          { signal: ac.signal, headers: { Accept: "application/json" } },
        );
        const body = (await res.json()) as {
          success?: boolean;
          items?: NewsFeedItem[];
          error?: { message?: string } | string;
        };
        if (ac.signal.aborted) return;
        if (res.status === 401) {
          setState({
            status: "error",
            message: t("relatedNewsUnavailable"),
            q,
            unauthorized: true,
          });
          return;
        }
        if (!res.ok || !body.success) {
          const msg =
            typeof body.error === "string"
              ? body.error
              : body.error?.message || t("errorRelatedNews");
          setState({ status: "error", message: msg, q });
          return;
        }
        const items = (body.items ?? []).slice(0, 5);
        if (items.length === 0) {
          setState({ status: "empty", q });
          return;
        }
        setState({ status: "ready", items, q });
      } catch (e) {
        if (ac.signal.aborted) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : t("errorRelatedNews"),
          q,
        });
      }
    })();

    return () => ac.abort();
    // props identity changes; depKey covers the query inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depKey encodes props
  }, [depKey, t]);

  const searchQ =
    state.status === "ready" ||
    state.status === "empty" ||
    state.status === "error"
      ? state.q
      : buildQuery(props);

  return (
    <section
      className="mt-4 flex flex-col gap-3 border-t border-border pt-4"
      aria-label={t("relatedNews")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          <Newspaper className="size-3.5" aria-hidden />
          {t("relatedNews")}
        </h2>
        <Link
          href={newsBridgeHref({ q: searchQ })}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("searchOnNews")}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>

      {state.status === "loading" ? (
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("loadingRelatedNews")}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-[13px] text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "empty" ? (
        <p className="text-[13px] text-muted-foreground">{t("noRelatedNews")}</p>
      ) : null}

      {state.status === "ready" ? (
        <ul className="flex flex-col gap-2">
          {state.items.map((item) => (
            <li key={item.id}>
              <Link
                href={newsBridgeHref({ q: searchQ, story: item.id })}
                className="flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-background/60 px-3 py-2.5 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="line-clamp-2 text-[13px] font-medium text-foreground">
                  {item.title}
                </span>
                {item.sourceDisplayName || item.excerpt ? (
                  <span className="line-clamp-2 text-[12px] text-muted-foreground">
                    {item.sourceDisplayName
                      ? item.sourceDisplayName
                      : item.excerpt}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
