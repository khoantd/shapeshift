"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { PanelRailButton } from "@/components/youtube/panel-rail";
import { GITHUB_TOPIC_CATALOG } from "@/lib/github/topics";
import type { GithubRepoCard } from "@/lib/github/types";

export type GitHubListMode = "trending" | "filter" | "api";

export type GitHubFavoritesPanelProps = {
  variant: "sidebar" | "stacked";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  favoriteTopicIds: string[];
  onToggleTopic: (topicId: string) => void;
  favoritesSaving: boolean;
  canPersistFavorites: boolean;
  oauthClientConfigured: boolean;
  oauthConnected: boolean;
  oauthEmail: string | null;
  oauthBusy: boolean;
  onSignOut: () => void;
  repos: GithubRepoCard[];
  selectedRepoId: number | null;
  onSelectRepo: (repo: GithubRepoCard) => void;
  trendingBusy: boolean;
  trendingError: string | null;
  fetchedAt: number | null;
  onRefresh: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchClear: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  listMode: GitHubListMode;
  searchBusy: boolean;
  searchError: string | null;
};

function formatUpdated(fetchedAt: number | null): string | null {
  if (!fetchedAt) return null;
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60_000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "Updated 1 hour ago" : `Updated ${hours} hours ago`;
}

export function GitHubFavoritesPanel({
  variant,
  collapsed,
  onToggleCollapsed,
  favoriteTopicIds,
  onToggleTopic,
  favoritesSaving,
  canPersistFavorites,
  oauthClientConfigured,
  oauthConnected,
  oauthEmail,
  oauthBusy,
  onSignOut,
  repos,
  selectedRepoId,
  onSelectRepo,
  trendingBusy,
  trendingError,
  fetchedAt,
  onRefresh,
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  onSearchClear,
  onSearchKeyDown,
  listMode,
  searchBusy,
  searchError,
}: GitHubFavoritesPanelProps) {
  const t = useTranslations("GitHub");
  const favSet = new Set(favoriteTopicIds);
  const updatedLabel = formatUpdated(fetchedAt);
  const listBusy = listMode === "api" ? searchBusy : trendingBusy;
  const listError = listMode === "api" ? searchError : trendingError;
  const sectionLabel =
    listMode === "api" || listMode === "filter"
      ? t("searchResults")
      : t("trending");
  const emptyMessage =
    listMode === "api" || listMode === "filter"
      ? t("noSearchResults")
      : t("noRepos");
  const loadingMessage =
    listMode === "api" ? t("loadingSearch") : t("loadingTrending");

  const focusSearch = () => {
    if (collapsed) onToggleCollapsed();
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  if (variant === "sidebar" && collapsed) {
    return (
      <aside
        className="relative flex w-12 shrink-0 flex-col items-center gap-2 border-e border-border bg-background/40 py-3"
        aria-label={t("sidebar")}
      >
        <BrandBackdrop src="/brand/main.jpg" scrub="medium" position="left center" />
        <div className="relative z-[1] flex flex-col items-center gap-2">
          <PanelRailButton
            label={t("expandSidebar")}
            onClick={onToggleCollapsed}
            icon={ChevronRight}
          />
          <PanelRailButton
            label={t("searchLabel")}
            onClick={focusSearch}
            icon={Search}
          />
          <PanelRailButton
            label={t("refresh")}
            onClick={onRefresh}
            icon={RefreshCw}
            disabled={trendingBusy}
          />
        </div>
      </aside>
    );
  }

  const shellClass =
    variant === "sidebar"
      ? "relative flex w-[min(100%,380px)] shrink-0 flex-col border-e border-border bg-background/50 lg:h-full"
      : "relative flex max-h-[55vh] w-full shrink-0 flex-col border-b border-border bg-background/50 lg:max-h-none";

  return (
    <aside className={shellClass} aria-label={t("sidebar")}>
      <BrandBackdrop src="/brand/main.jpg" scrub="medium" position="left center" />
      <header className="relative z-[1] flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch className="size-4 shrink-0 text-foreground" aria-hidden />
            <h2 className="truncate text-[14px] font-semibold text-foreground">
              {t("title")}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={trendingBusy}
              aria-label={t("refresh")}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
            >
              <RefreshCw
                className={`size-4 ${trendingBusy ? "animate-spin motion-reduce:animate-none" : ""}`}
                aria-hidden
              />
            </button>
            {variant === "sidebar" ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={t("collapseSidebar")}
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {oauthClientConfigured ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] leading-4 text-muted-foreground">
              {t("signInHint")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {oauthConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[12px] text-foreground">
                    {oauthEmail ?? t("signedIn")}
                  </span>
                  <button
                    type="button"
                    disabled={oauthBusy}
                    onClick={onSignOut}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <LogOut className="size-3" aria-hidden />
                    {t("signOut")}
                  </button>
                </>
              ) : (
                <a
                  href="/api/youtube/oauth/start?returnTo=/github"
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <LogIn className="size-3.5" aria-hidden />
                  {t("signIn")}
                </a>
              )}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <label htmlFor="github-repo-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            id="github-repo-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-busy={searchBusy}
            className="h-10 w-full rounded-md border border-border bg-background pe-9 ps-9 text-[13px] text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={onSearchClear}
              aria-label={t("searchClear")}
              className="absolute end-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
        <section className="flex flex-col gap-2" aria-label={t("favorites")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("favorites")}
            </p>
            {favoritesSaving ? (
              <LoaderCircle
                className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
                aria-label={t("saving")}
              />
            ) : null}
          </div>
          {!canPersistFavorites ? (
            <p className="text-[12px] text-muted-foreground">{t("localOnlyHint")}</p>
          ) : null}
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

        <section
          className="flex min-h-0 flex-1 flex-col gap-2"
          aria-label={sectionLabel}
          aria-busy={listBusy}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {sectionLabel}
            </p>
            {listMode === "trending" && updatedLabel ? (
              <span className="text-[11px] text-muted-foreground">{updatedLabel}</span>
            ) : listBusy ? (
              <LoaderCircle
                className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
                aria-hidden
              />
            ) : repos.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {repos.length}
              </span>
            ) : null}
          </div>
          {listError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive">
              {listError}
            </p>
          ) : null}
          {listBusy && repos.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              {loadingMessage}
            </p>
          ) : null}
          {!listBusy && repos.length === 0 && !listError ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={onSearchClear}
                  className="inline-flex h-8 w-fit cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("searchClear")}
                </button>
              ) : null}
            </div>
          ) : null}
          <ul className="flex flex-col gap-1.5" role="listbox" aria-label={sectionLabel}>
            {repos.map((repo) => {
              const selected = repo.id === selectedRepoId;
              return (
                <li key={repo.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelectRepo(repo)}
                    className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      selected
                        ? "bg-muted text-foreground"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="truncate text-[13px] font-medium">
                      {repo.fullName}
                    </span>
                    <span className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3" aria-hidden />
                        {repo.stars.toLocaleString()}
                      </span>
                      {repo.language ? <span>{repo.language}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </aside>
  );
}
