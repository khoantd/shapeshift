"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Loader2, Sparkles, Star, X } from "lucide-react";
import { MarkdownBody } from "@shapeshift/react";
import { GITHUB_TOPIC_CATALOG } from "@/lib/github/topics";
import type { GithubRepoCard } from "@/lib/github/types";
import type { AppLocale } from "@/i18n/routing";

type ReadmeState =
  | { status: "idle" | "loading" }
  | { status: "ready"; markdown: string }
  | { status: "missing" }
  | { status: "error"; message: string };

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string; unavailable?: boolean };

const summaryCache = new Map<string, string>();

export function GitHubRepoDetail({
  repo,
  onClose,
}: {
  repo: GithubRepoCard;
  onClose: () => void;
}) {
  const t = useTranslations("GitHub");
  const locale = useLocale() as AppLocale;
  const matched = GITHUB_TOPIC_CATALOG.filter((topic) =>
    repo.matchedTopicIds.includes(topic.id),
  );

  const [readme, setReadme] = useState<ReadmeState>({ status: "loading" });
  const [summary, setSummary] = useState<SummaryState>(() => {
    const cached = summaryCache.get(repo.fullName);
    return cached
      ? { status: "ready", text: cached }
      : { status: "idle" };
  });
  const readmeMarkdownRef = useRef<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const cached = summaryCache.get(repo.fullName);
    setSummary(
      cached ? { status: "ready", text: cached } : { status: "idle" },
    );
    setReadme({ status: "loading" });
    readmeMarkdownRef.current = null;

    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/github/readme?repo=${encodeURIComponent(repo.fullName)}`,
          { signal: ac.signal },
        );
        const body = (await res.json()) as {
          success?: boolean;
          markdown?: string;
          error?: string;
          reason?: string;
        };
        if (ac.signal.aborted) return;
        if (res.status === 404 || body.reason === "missing") {
          setReadme({ status: "missing" });
          return;
        }
        if (!res.ok || !body.success || typeof body.markdown !== "string") {
          setReadme({
            status: "error",
            message: body.error || tRef.current("errorReadme"),
          });
          return;
        }
        readmeMarkdownRef.current = body.markdown;
        setReadme({ status: "ready", markdown: body.markdown });
      } catch (e) {
        if (ac.signal.aborted) return;
        setReadme({
          status: "error",
          message:
            e instanceof Error ? e.message : tRef.current("errorReadme"),
        });
      }
    })();

    return () => ac.abort();
  }, [repo.fullName]);

  async function onSummarize(force = false) {
    setSummary({ status: "loading" });
    try {
      const res = await fetch("/api/github/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          description: repo.description,
          readme: readmeMarkdownRef.current ?? undefined,
          language: locale === "vi" ? "vi" : "en",
          ...(force ? { force: true } : {}),
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        text?: string;
        error?: string;
      };
      if (!res.ok || !body.success || typeof body.text !== "string") {
        setSummary({
          status: "error",
          message:
            body.error ||
            (res.status === 503 ? t("summaryUnavailable") : t("errorSummary")),
          unavailable: res.status === 503,
        });
        return;
      }
      summaryCache.set(repo.fullName, body.text);
      setSummary({ status: "ready", text: body.text });
    } catch (e) {
      setSummary({
        status: "error",
        message: e instanceof Error ? e.message : t("errorSummary"),
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("selectedRepo")}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {repo.fullName}
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {repo.description ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5" aria-hidden />
            {repo.stars.toLocaleString()} {t("stars")}
          </span>
          <span>
            {repo.forks.toLocaleString()} {t("forks")}
          </span>
          {repo.language ? <span>{repo.language}</span> : null}
        </div>

        {matched.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {matched.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex h-7 items-center rounded-md border border-border bg-muted/40 px-2 text-[12px] text-foreground"
              >
                {topic.label}
              </span>
            ))}
          </div>
        ) : null}

        {repo.topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {repo.topics.slice(0, 12).map((topic) => (
              <span
                key={topic}
                className="inline-flex h-6 items-center rounded-md bg-muted/50 px-2 text-[11px] text-muted-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}

        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("openOnGithub")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>

        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("summary")}
            </h2>
            {summary.status === "ready" ? (
              <button
                type="button"
                onClick={() => void onSummarize(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("regenerateSummary")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSummarize(false)}
                disabled={
                  summary.status === "loading" ||
                  readme.status === "loading" ||
                  readme.status === "missing"
                }
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {summary.status === "loading" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {summary.status === "loading"
                  ? t("summarizing")
                  : t("summarize")}
              </button>
            )}
          </div>
          {summary.status === "idle" ? (
            <p className="text-[13px] text-muted-foreground">
              {t("summaryHint")}
            </p>
          ) : null}
          {summary.status === "loading" ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t("summarizing")}
            </p>
          ) : null}
          {summary.status === "error" ? (
            <p className="text-[13px] text-destructive" role="alert">
              {summary.message}
            </p>
          ) : null}
          {summary.status === "ready" ? (
            <MarkdownBody className="text-foreground">
              {summary.text}
            </MarkdownBody>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-5 pb-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("readme")}
          </h2>
          {readme.status === "loading" ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t("loadingReadme")}
            </p>
          ) : null}
          {readme.status === "missing" ? (
            <p className="text-[13px] text-muted-foreground">{t("noReadme")}</p>
          ) : null}
          {readme.status === "error" ? (
            <p className="text-[13px] text-destructive" role="alert">
              {readme.message}
            </p>
          ) : null}
          {readme.status === "ready" ? (
            <MarkdownBody className="text-foreground">
              {readme.markdown}
            </MarkdownBody>
          ) : null}
        </section>
      </div>
    </div>
  );
}
