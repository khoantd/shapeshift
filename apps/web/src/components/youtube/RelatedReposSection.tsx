"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, GitBranch, Loader2, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { GithubRepoCard } from "@/lib/github/types";
import {
  buildRelatedReposQuery,
  githubBridgeHref,
} from "@/lib/youtube/relatedReposQuery";

type State =
  | { status: "idle" | "loading" }
  | { status: "ready"; repos: GithubRepoCard[]; q: string }
  | { status: "empty"; q: string }
  | { status: "error"; message: string; q: string };

export function RelatedReposSection({
  title,
  channelTitle,
  topicLabel,
}: {
  title: string;
  channelTitle?: string | null;
  topicLabel?: string | null;
}) {
  const t = useTranslations("YouTube");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const q = buildRelatedReposQuery({ title, channelTitle, topicLabel });
    const ac = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(
          `/api/github/search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        const body = (await res.json()) as {
          success?: boolean;
          repos?: GithubRepoCard[];
          error?: { message?: string } | string;
        };
        if (ac.signal.aborted) return;
        if (!res.ok || !body.success) {
          const msg =
            typeof body.error === "string"
              ? body.error
              : body.error?.message || t("errorRelatedRepos");
          setState({ status: "error", message: msg, q });
          return;
        }
        const repos = (body.repos ?? []).slice(0, 5);
        if (repos.length === 0) {
          setState({ status: "empty", q });
          return;
        }
        setState({ status: "ready", repos, q });
      } catch (e) {
        if (ac.signal.aborted) return;
        setState({
          status: "error",
          message:
            e instanceof Error ? e.message : t("errorRelatedRepos"),
          q,
        });
      }
    })();

    return () => ac.abort();
  }, [title, channelTitle, topicLabel, t]);

  const searchQ =
    state.status === "ready" ||
    state.status === "empty" ||
    state.status === "error"
      ? state.q
      : buildRelatedReposQuery({ title, channelTitle, topicLabel });

  return (
    <section
      className="mt-4 flex flex-col gap-3 border-t border-border pt-4"
      aria-label={t("relatedRepos")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          <GitBranch className="size-3.5" aria-hidden />
          {t("relatedRepos")}
        </h2>
        <Link
          href={githubBridgeHref({ q: searchQ })}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("searchOnGitHub")}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>

      {state.status === "loading" ? (
        <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("loadingRelatedRepos")}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-[13px] text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "empty" ? (
        <p className="text-[13px] text-muted-foreground">
          {t("noRelatedRepos")}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <ul className="flex flex-col gap-2">
          {state.repos.map((repo) => (
            <li key={repo.id}>
              <Link
                href={githubBridgeHref({
                  q: searchQ,
                  repo: repo.fullName,
                })}
                className="flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-background/60 px-3 py-2.5 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="truncate text-[13px] font-medium text-foreground">
                  {repo.fullName}
                </span>
                {repo.description ? (
                  <span className="line-clamp-2 text-[12px] text-muted-foreground">
                    {repo.description}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Star className="size-3" aria-hidden />
                  {repo.stars.toLocaleString()}
                  {repo.language ? (
                    <>
                      <span aria-hidden>·</span>
                      {repo.language}
                    </>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
