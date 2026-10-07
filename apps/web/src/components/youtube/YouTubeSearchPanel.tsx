"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Play,
  Search,
  Video,
  X,
} from "lucide-react";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { PanelRailButton } from "@/components/youtube/panel-rail";
import { contentTypeLabel } from "@/lib/youtube/learningPackHistoryStats";
import {
  formatRelativeTime,
  type HistoryPack,
} from "@/lib/youtube/historyPack";
import type { YouTubeVideo } from "@/lib/youtube/types";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";

export type YouTubeSearchPanelProps = {
  variant: "sidebar" | "stacked";
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
  listboxId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  historySectionRef?: RefObject<HTMLDivElement | null>;
  serverConfigured: boolean;
  setupMessage: string | null;
  youtubeOAuthClientConfigured: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  videos: YouTubeVideo[];
  selected: YouTubeVideo | null;
  activeIndex: number;
  searchBusy: boolean;
  searchError: string | null;
  showResultsPanel: boolean;
  onSelectVideo: (video: YouTubeVideo) => void;
  oauthConnected: boolean;
  oauthEmail: string | null;
  oauthHasSub: boolean;
  oauthBusy: boolean;
  onSignOut: () => void;
  historyPacks: HistoryPack[];
  historyBusy: boolean;
  historyError: string | null;
  activeHistoryId: string | null;
  onOpenHistoryPack: (item: HistoryPack) => void;
};

export function YouTubeSearchPanel({
  variant,
  collapsed,
  onCollapsedChange,
  className = "",
  listboxId,
  inputRef,
  historySectionRef,
  serverConfigured,
  setupMessage,
  youtubeOAuthClientConfigured,
  query,
  onQueryChange,
  onKeyDown,
  onClear,
  videos,
  selected,
  activeIndex,
  searchBusy,
  searchError,
  showResultsPanel,
  onSelectVideo,
  oauthConnected,
  oauthEmail,
  oauthHasSub,
  oauthBusy,
  onSignOut,
  historyPacks,
  historyBusy,
  historyError,
  activeHistoryId,
  onOpenHistoryPack,
}: YouTubeSearchPanelProps) {
  const t = useTranslations("YouTube");
  const expand = () => onCollapsedChange(false);
  const collapse = () => onCollapsedChange(true);

  const focusSearch = () => {
    expand();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openHistory = () => {
    expand();
    requestAnimationFrame(() => {
      historySectionRef?.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  if (collapsed) {
    if (variant === "sidebar") {
      return (
        <aside
          className={`relative z-10 hidden h-full w-12 shrink-0 flex-col items-center gap-2 overflow-hidden border-r border-border bg-background/50 py-3 lg:flex ${className}`}
          aria-label="Search panel collapsed"
        >
          <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="left top" />
          <div className="relative z-[1] flex flex-col items-center gap-2">
          <PanelRailButton
            label="Show search panel"
            onClick={expand}
            icon={ChevronRight}
          />
          <div className="my-1 h-px w-6 bg-border" aria-hidden />
          <PanelRailButton label="Search videos" onClick={focusSearch} icon={Search} />
          {oauthConnected && (
            <PanelRailButton
              label="Saved packs"
              onClick={openHistory}
              icon={History}
              pressed={historyPacks.length > 0}
            />
          )}
          </div>
        </aside>
      );
    }
    return (
      <div
        className={`relative flex w-full items-center gap-1 overflow-hidden border-b border-border bg-background/50 px-2 py-1.5 lg:hidden ${className}`}
        aria-label="Search panel collapsed"
      >
        <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="center" />
        <button
          type="button"
          onClick={focusSearch}
          className="relative z-[1] inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Search className="size-3.5" aria-hidden />
          Show search
        </button>
        {oauthConnected && (
          <PanelRailButton label="Saved packs" onClick={openHistory} icon={History} />
        )}
      </div>
    );
  }

  const shellClass =
    variant === "sidebar"
      ? `relative z-10 hidden h-full w-[380px] shrink-0 flex-col overflow-hidden border-r border-border bg-background/50 lg:flex ${className}`
      : `relative z-10 flex max-h-[min(55vh,28rem)] w-full shrink-0 flex-col overflow-hidden border-b border-border bg-background/50 lg:hidden ${className}`;

  return (
    <aside className={shellClass} aria-label="Search and saved packs">
      <BrandBackdrop src="/brand/main.jpg" scrub="medium" position="left center" />
      <header className="relative z-[1] flex shrink-0 flex-col gap-4 px-4 pt-6 pb-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
              <Video className="size-3.5" aria-hidden />
              YouTube
            </p>
            <h1 className="mt-1 text-[28px] leading-8 font-[550] tracking-tight text-balance">
              Search or paste a link
            </h1>
            <p className="mt-1.5 text-[14px] leading-5 text-muted-foreground">
              Find a video → Watch → Study with a pack and graph.
            </p>
          </div>
          <button
            type="button"
            onClick={collapse}
            aria-label="Hide search panel"
            aria-expanded
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:size-8"
          >
            {variant === "sidebar" ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <X className="size-4" aria-hidden />
            )}
          </button>
        </div>

        {!serverConfigured && (
          <div
            role="status"
            className="rounded-md border border-border bg-muted/50 px-3 py-3 text-[13px] leading-5 text-ink-2"
          >
            <p className="font-medium text-foreground">YouTube setup needed</p>
            <p className="mt-1 text-muted-foreground">
              {setupMessage ?? "YouTube Data API key is not configured."}
            </p>
          </div>
        )}

        <div className="relative">
          <label htmlFor={`youtube-search-${variant}`} className="sr-only">
            Search query or YouTube URL
          </label>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            id={`youtube-search-${variant}`}
            type="search"
            name="q"
            autoComplete="off"
            spellCheck={false}
            disabled={!serverConfigured}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("searchPlaceholder")}
            role="combobox"
            aria-expanded={videos.length > 0}
            aria-controls={`${listboxId}-${variant}`}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0
                ? `${listboxId}-${variant}-option-${activeIndex}`
                : undefined
            }
            className="h-11 w-full cursor-text rounded-md border border-border bg-background pe-10 ps-10 text-[15px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {(query || selected) && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="absolute end-2 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {youtubeOAuthClientConfigured && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] leading-4 text-muted-foreground">
              Sign in to save packs and fetch captions for videos you own.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {oauthConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[12px] text-ink-2">
                    {oauthEmail ?? "Signed in"}
                  </span>
                  <button
                    type="button"
                    disabled={oauthBusy}
                    onClick={onSignOut}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <LogOut className="size-3" aria-hidden />
                    Sign out
                  </button>
                </>
              ) : (
                <a
                  href="/api/youtube/oauth/start?returnTo=/youtube"
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <LogIn className="size-3.5" aria-hidden />
                  Sign in with Google
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 sm:px-5">
        {showResultsPanel && (
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                Results
              </h2>
              {videos.length > 0 && (
                <p className="text-[12px] text-muted-foreground" role="status" aria-atomic="true">
                  {searchBusy
                    ? "Refreshing…"
                    : `${videos.length} video${videos.length === 1 ? "" : "s"}`}
                </p>
              )}
            </div>

            <ul
              id={`${listboxId}-${variant}`}
              role="listbox"
              aria-label="YouTube search results"
              aria-busy={searchBusy}
              className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background"
            >
              {searchBusy && videos.length === 0 && (
                <>
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="px-3 py-3" aria-hidden>
                      <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                      <span className="mt-2 block h-3 w-full animate-pulse rounded bg-muted" />
                    </li>
                  ))}
                </>
              )}
              {searchError && (
                <li className="px-3 py-3 text-[13px] text-muted-foreground" role="status">
                  {searchError}
                </li>
              )}
              {!searchBusy &&
                !searchError &&
                videos.length === 0 &&
                query.trim().length >= 2 && (
                  <li className="px-3 py-3 text-[13px] text-muted-foreground" role="status">
                    No videos found. Try another topic or paste a YouTube link.
                  </li>
                )}
              {videos.map((video, i) => {
                const active = i === activeIndex;
                const isSelected = selected?.videoId === video.videoId;
                return (
                  <li
                    key={video.videoId}
                    id={`${listboxId}-${variant}-option-${i}`}
                    role="option"
                    aria-selected={isSelected || active}
                    className={`flex items-start gap-0.5 pe-1 transition-colors duration-150 ${
                      isSelected || active ? "bg-muted/70" : "hover:bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectVideo(video)}
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 px-3 py-3 text-start focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                    >
                      {video.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnails
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          width={72}
                          height={40}
                          className="mt-0.5 h-10 w-[72px] shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="mt-0.5 flex h-10 w-[72px] shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                          <Play className="size-3.5" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[13px] leading-4 font-medium text-foreground">
                          {video.title}
                        </span>
                        {video.channelTitle && (
                          <span className="mt-1 block truncate text-[12px] text-muted-foreground">
                            {video.channelTitle}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!showResultsPanel && serverConfigured && (
          <div
            className="rounded-md border border-dashed border-border px-3 py-6 text-center"
            role="status"
          >
            <Search className="mx-auto size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-[14px] font-medium text-foreground">Search videos</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Start typing a topic, or paste a youtube.com / youtu.be link.
            </p>
          </div>
        )}

        {oauthConnected && (
          <div
            ref={historySectionRef}
            className="flex flex-col gap-2 border-t border-border pt-3"
          >
            <h2 className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
              <History className="size-3.5" aria-hidden />
              Saved packs
            </h2>
            {historyBusy && (
              <p
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
                aria-live="polite"
              >
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                Loading…
              </p>
            )}
            {historyError && (
              <p className="text-[13px] text-destructive" role="alert">
                {historyError}
              </p>
            )}
            {!historyBusy && !historyError && historyPacks.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                {oauthHasSub
                  ? "Generate a learning pack while signed in to save it here."
                  : "Refreshing Google session for history…"}
              </p>
            )}
            {!historyBusy && historyError && !oauthHasSub && (
              <p className="text-[12px] text-muted-foreground">
                Tip: use Sign out, then Sign in with Google once.
              </p>
            )}
            {!historyBusy && historyPacks.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
                {historyPacks.map((item) => {
                  const selectedHist = activeHistoryId === item.id;
                  const watchUrl = item.videoUrl || youtubeWatchUrl(item.videoId);
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-stretch gap-0 transition-colors duration-150 ${
                          selectedHist ? "bg-muted/70" : "hover:bg-muted/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenHistoryPack(item)}
                          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnails */}
                          <img
                            src={
                              item.thumbnailUrl || youtubeThumbnailUrl(item.videoId)
                            }
                            alt=""
                            width={72}
                            height={40}
                            className="mt-0.5 h-10 w-[72px] shrink-0 rounded object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-[13px] font-medium text-foreground">
                              {item.videoTitle}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {item.contentType && (
                                <span className="inline-flex h-5 items-center rounded bg-secondary px-1.5 text-[11px] font-medium text-ink-2">
                                  {contentTypeLabel(item.contentType)}
                                </span>
                              )}
                              <span className="text-[12px] text-muted-foreground">
                                {item.conceptCount} concept
                                {item.conceptCount === 1 ? "" : "s"}
                                {" · "}
                                {item.termCount} term
                                {item.termCount === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-1 block text-[12px] text-muted-foreground">
                              {item.channelTitle ? `${item.channelTitle} · ` : ""}
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </span>
                        </button>
                        <a
                          href={watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${item.videoTitle} on YouTube`}
                          title="Open on YouTube"
                          className="inline-flex shrink-0 cursor-pointer items-center justify-center border-l border-border px-2.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
