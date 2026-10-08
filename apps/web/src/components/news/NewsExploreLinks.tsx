"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, GitBranch, PlaySquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { youtubeBridgeHref } from "@/lib/github/relatedVideosQuery";
import {
  buildRelatedReposFromNewsQuery,
  buildRelatedVideosFromNewsQuery,
} from "@/lib/news/relatedNewsQuery";
import { githubBridgeHref } from "@/lib/youtube/relatedReposQuery";

/** Always-visible YouTube / GitHub deep links for a news story (no API wait). */
export function NewsExploreLinks({
  title,
  sourceDisplayName,
}: {
  title: string;
  sourceDisplayName?: string | null;
}) {
  const t = useTranslations("News");
  const videoQ = buildRelatedVideosFromNewsQuery({ title, sourceDisplayName });
  const repoQ = buildRelatedReposFromNewsQuery({ title, sourceDisplayName });

  return (
    <nav
      className="flex flex-wrap items-center gap-2"
      aria-label={t("exploreRelated")}
    >
      <Link
        href={youtubeBridgeHref({ q: videoQ })}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <PlaySquare className="size-3.5 text-muted-foreground" aria-hidden />
        {t("searchOnYouTube")}
        <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
      </Link>
      <Link
        href={githubBridgeHref({ q: repoQ })}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <GitBranch className="size-3.5 text-muted-foreground" aria-hidden />
        {t("searchOnGitHub")}
        <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
      </Link>
    </nav>
  );
}
