"use client";

import { useTranslations } from "next-intl";
import { GitBranch, Newspaper, Sparkles, Star } from "lucide-react";
import type { GithubRepoCard } from "@/lib/github/types";
import { GITHUB_TOPIC_CATALOG } from "@/lib/github/topics";

export type GitHubHomeEmptyStateProps = {
  trendingPreview: GithubRepoCard[];
  favoriteTopicIds: string[];
  onToggleTopic: (topicId: string) => void;
  onSelectRepo: (repo: GithubRepoCard) => void;
  onFocusFavorites: () => void;
};

export function GitHubHomeEmptyState({
  trendingPreview,
  favoriteTopicIds,
  onToggleTopic,
  onSelectRepo,
  onFocusFavorites,
}: GitHubHomeEmptyStateProps) {
  const t = useTranslations("GitHub");
  const favSet = new Set(favoriteTopicIds);

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto bg-muted/20"
      aria-label={t("home")}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:max-w-4xl sm:px-6 lg:max-w-5xl lg:px-8">
        <section className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <GitBranch className="size-5 text-foreground" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t("emptyTitle")}
              </h1>
              <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                {t("emptyDescription")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Step
              icon={Sparkles}
              title={t("stepFavoritesTitle")}
              body={t("stepFavoritesBody")}
            />
            <Step
              icon={Star}
              title={t("stepTrendingTitle")}
              body={t("stepTrendingBody")}
            />
            <Step
              icon={Newspaper}
              title={t("stepNewsTitle")}
              body={t("stepNewsBody")}
            />
          </div>
          <button
            type="button"
            onClick={onFocusFavorites}
            className="inline-flex h-10 w-fit cursor-pointer items-center rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("pickFavorites")}
          </button>
        </section>

        <section className="flex flex-col gap-2.5" aria-label={t("topics")}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("topics")}
          </p>
          <div className="flex flex-wrap gap-2">
            {GITHUB_TOPIC_CATALOG.map((topic) => {
              const pressed = favSet.has(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onToggleTopic(topic.id)}
                  className={`inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    pressed
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {topic.label}
                </button>
              );
            })}
          </div>
        </section>

        {trendingPreview.length > 0 && (
          <section
            className="flex flex-col gap-2.5"
            aria-label={t("trendingPreview")}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("trendingPreview")}
            </p>
            <ul className="flex flex-col gap-2">
              {trendingPreview.slice(0, 5).map((repo) => (
                <li key={repo.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRepo(repo)}
                    className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md border border-border bg-background/80 px-3 py-2.5 text-start transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="text-[14px] font-medium text-foreground">
                      {repo.fullName}
                    </span>
                    {repo.description ? (
                      <span className="line-clamp-2 text-[13px] text-muted-foreground">
                        {repo.description}
                      </span>
                    ) : null}
                    <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3" aria-hidden />
                        {repo.stars.toLocaleString()}
                      </span>
                      {repo.language ? <span>{repo.language}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-background/70 px-3 py-3">
      <Icon className="size-4 text-foreground" aria-hidden />
      <p className="mt-2 text-[13px] font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
