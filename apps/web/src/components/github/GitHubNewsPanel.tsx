"use client";

import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Newspaper,
  Tag,
} from "lucide-react";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { PanelRailButton } from "@/components/youtube/panel-rail";
import type { GithubHeadline, GithubReleaseItem } from "@/lib/github/types";

export type GitHubNewsTab = "activity" | "headlines";

export type GitHubNewsPanelProps = {
  variant: "sidebar" | "stacked";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tab: GitHubNewsTab;
  onTabChange: (tab: GitHubNewsTab) => void;
  releases: GithubReleaseItem[];
  headlines: GithubHeadline[];
  activityBusy: boolean;
  headlinesBusy: boolean;
  activityError: string | null;
  headlinesError: string | null;
  headlinesConfigured: boolean;
};

export function GitHubNewsPanel({
  variant,
  collapsed,
  onToggleCollapsed,
  tab,
  onTabChange,
  releases,
  headlines,
  activityBusy,
  headlinesBusy,
  activityError,
  headlinesError,
  headlinesConfigured,
}: GitHubNewsPanelProps) {
  const t = useTranslations("GitHub");

  if (variant === "sidebar" && collapsed) {
    return (
      <aside
        className="relative flex w-12 shrink-0 flex-col items-center gap-2 border-s border-border bg-background/40 py-3"
        aria-label={t("newsPanel")}
      >
        <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="right center" />
        <div className="relative z-[1] flex flex-col items-center gap-2">
          <PanelRailButton
            label={t("expandNews")}
            onClick={onToggleCollapsed}
            icon={ChevronLeft}
          />
          <PanelRailButton
            label={t("tabActivity")}
            onClick={() => {
              onTabChange("activity");
              onToggleCollapsed();
            }}
            icon={Tag}
            pressed={tab === "activity"}
          />
          <PanelRailButton
            label={t("tabHeadlines")}
            onClick={() => {
              onTabChange("headlines");
              onToggleCollapsed();
            }}
            icon={Newspaper}
            pressed={tab === "headlines"}
          />
        </div>
      </aside>
    );
  }

  const shellClass =
    variant === "sidebar"
      ? "relative flex w-[min(100%,360px)] shrink-0 flex-col border-s border-border bg-background/50 lg:h-full"
      : "relative flex max-h-[45vh] w-full shrink-0 flex-col border-t border-border bg-background/50";

  return (
    <aside className={shellClass} aria-label={t("newsPanel")}>
      <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="right center" />
      <header className="relative z-[1] flex items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Newspaper className="size-4 shrink-0" aria-hidden />
          <h2 className="truncate text-[14px] font-semibold text-foreground">
            {t("newsPanel")}
          </h2>
        </div>
        {variant === "sidebar" ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={t("collapseNews")}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : null}
      </header>

      <div
        role="tablist"
        aria-label={t("newsTabs")}
        className="relative z-[1] flex gap-1 border-b border-border/60 px-3 py-2"
      >
        {(
          [
            ["activity", t("tabActivity")],
            ["headlines", t("tabHeadlines")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTabChange(id)}
            className={`inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              tab === id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === "activity" ? (
          <ActivityList
            releases={releases}
            busy={activityBusy}
            error={activityError}
          />
        ) : (
          <HeadlinesList
            headlines={headlines}
            busy={headlinesBusy}
            error={headlinesError}
            configured={headlinesConfigured}
          />
        )}
      </div>
    </aside>
  );
}

function ActivityList({
  releases,
  busy,
  error,
}: {
  releases: GithubReleaseItem[];
  busy: boolean;
  error: string | null;
}) {
  const t = useTranslations("GitHub");
  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive">
        {error}
      </p>
    );
  }
  if (busy && releases.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("loadingActivity")}
      </p>
    );
  }
  if (releases.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">{t("noActivity")}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {releases.map((r) => (
        <li key={`${r.repoFullName}-${r.id}`}>
          <a
            href={r.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="text-[12px] text-muted-foreground">
              {r.repoFullName}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              {r.name || r.tagName}
              <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
            </span>
            {r.publishedAt ? (
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.publishedAt).toLocaleDateString()}
                {r.prerelease ? ` · ${t("prerelease")}` : ""}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

function HeadlinesList({
  headlines,
  busy,
  error,
  configured,
}: {
  headlines: GithubHeadline[];
  busy: boolean;
  error: string | null;
  configured: boolean;
}) {
  const t = useTranslations("GitHub");
  if (!configured) {
    return (
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {t("headlinesNotConfigured")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive">
        {error}
      </p>
    );
  }
  if (busy && headlines.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("loadingHeadlines")}
      </p>
    );
  }
  if (headlines.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">{t("noHeadlines")}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {headlines.map((h) => (
        <li key={h.id}>
          <a
            href={h.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="inline-flex items-start gap-1.5 text-[13px] font-medium leading-snug text-foreground">
              <span className="min-w-0 flex-1">{h.title}</span>
              <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-60" aria-hidden />
            </span>
            <span className="text-[11px] text-muted-foreground">
              {[h.source, h.date].filter(Boolean).join(" · ")}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
