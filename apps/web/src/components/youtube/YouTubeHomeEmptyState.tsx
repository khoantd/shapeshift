"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BookOpen,
  Network,
  Play,
  Search,
  Video,
} from "lucide-react";
import type { HistoryPack } from "@/lib/youtube/historyPack";
import { formatRelativeTime } from "@/lib/youtube/historyPack";
import { contentTypeLabel } from "@/lib/youtube/learningPackHistoryStats";
import {
  HOME_TOPIC_CHIPS,
  pickContinuePack,
  pickMorePacks,
  pickTeaserGraphPack,
} from "@/lib/youtube/homeEmptyState";
import { youtubeThumbnailUrl } from "@/lib/youtube/url";
import { ArcGraphCanvas } from "@/components/youtube/knowledge-graph/arc-graph-canvas";

export type YouTubeHomeEmptyStateProps = {
  historyPacks: HistoryPack[];
  historyBusy: boolean;
  onOpenPack: (item: HistoryPack) => void;
  onOpenGraph: (item: HistoryPack) => void;
  onTopicSelect: (topic: string) => void;
  onFocusSearch: () => void;
};

export function YouTubeHomeEmptyState({
  historyPacks,
  historyBusy,
  onOpenPack,
  onOpenGraph,
  onTopicSelect,
  onFocusSearch,
}: YouTubeHomeEmptyStateProps) {
  const t = useTranslations("YouTube");
  const continuePack = pickContinuePack(historyPacks);
  const teaserPack = pickTeaserGraphPack(historyPacks);
  const morePacks = pickMorePacks(historyPacks, 4);

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto bg-muted/20"
      aria-label={t("home")}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:max-w-4xl sm:px-6 lg:max-w-5xl lg:px-8">
        {continuePack ? (
          <ContinueHero
            pack={continuePack}
            onOpenPack={onOpenPack}
            onOpenGraph={onOpenGraph}
          />
        ) : (
          <HowItWorks onFocusSearch={onFocusSearch} historyBusy={historyBusy} />
        )}

        {teaserPack?.graphPayload && (
          <section
            className="flex flex-col gap-3"
            aria-label={t("knowledgeGraphPreview")}
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("yourLastGraph")}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {t("conceptsFrom")}{" "}
                  <span className="font-medium text-foreground">
                    {teaserPack.videoTitle}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenGraph(teaserPack)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Network className="size-3.5" aria-hidden />
                {t("exploreGraph")}
              </button>
            </div>
            <ArcGraphCanvas
              graph={teaserPack.graphPayload}
              layout="teaser"
              footerHint={`${teaserPack.graphPayload.nodes.length} nodes · ${teaserPack.graphPayload.links.length} relationships`}
            />
          </section>
        )}

        <section className="flex flex-col gap-2.5" aria-label={t("tryATopic")}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("tryATopic")}
          </p>
          <div className="flex flex-wrap gap-2">
            {HOME_TOPIC_CHIPS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onTopicSelect(topic)}
                className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {topic}
              </button>
            ))}
          </div>
        </section>

        {morePacks.length > 0 && (
          <section
            className="flex flex-col gap-2.5"
            aria-label={t("moreSavedPacks")}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("moreSavedPacks")}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {morePacks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPack(item)}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                      <span className="line-clamp-2 text-[13px] font-medium text-foreground">
                        {item.videoTitle}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {item.contentType && (
                          <span className="inline-flex h-5 items-center rounded bg-secondary px-1.5 text-[11px] font-medium text-ink-2">
                            {contentTypeLabel(item.contentType)}
                          </span>
                        )}
                        <span className="text-[12px] text-muted-foreground">
                          {t("concepts", { count: item.conceptCount })}
                          {" · "}
                          {t("terms", { count: item.termCount })}
                        </span>
                      </span>
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

function ContinueHero({
  pack,
  onOpenPack,
  onOpenGraph,
}: {
  pack: HistoryPack;
  onOpenPack: (item: HistoryPack) => void;
  onOpenGraph: (item: HistoryPack) => void;
}) {
  const t = useTranslations("YouTube");
  const thumb = pack.thumbnailUrl || youtubeThumbnailUrl(pack.videoId);
  const hasGraph = Boolean(pack.graphPayload);

  return (
    <section
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5"
      aria-label={t("continueStudying")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnails */}
      <img
        src={thumb}
        alt=""
        width={240}
        height={135}
        className="aspect-video w-full max-w-[240px] shrink-0 rounded-md border border-border object-cover sm:w-[240px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("continueStudying")}
        </p>
        <h2 className="mt-1 text-[17px] font-semibold leading-snug text-foreground">
          {pack.videoTitle}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {pack.channelTitle ? `${pack.channelTitle} · ` : ""}
          {formatRelativeTime(pack.createdAt)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {pack.contentType && (
            <span className="inline-flex h-5 items-center rounded bg-secondary px-1.5 text-[11px] font-medium text-ink-2">
              {contentTypeLabel(pack.contentType)}
            </span>
          )}
          <span className="text-[12px] text-muted-foreground">
            {t("concepts", { count: pack.conceptCount })}
            {" · "}
            {t("terms", { count: pack.termCount })}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenPack(pack)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BookOpen className="size-3.5" aria-hidden />
            {t("openPack")}
          </button>
          {hasGraph && (
            <button
              type="button"
              onClick={() => onOpenGraph(pack)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Network className="size-3.5" aria-hidden />
              {t("openGraph")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function HowItWorks({
  onFocusSearch,
  historyBusy,
}: {
  onFocusSearch: () => void;
  historyBusy: boolean;
}) {
  const t = useTranslations("YouTube");

  return (
    <section
      className="flex flex-col items-center gap-5 text-center"
      aria-label={t("howItWorks")}
    >
      <div className="flex flex-col items-center gap-2">
        <Video className="size-8 text-muted-foreground" aria-hidden />
        <h2 className="text-[17px] font-semibold text-foreground">
          {historyBusy ? t("loadingPacks") : t("emptyStateTitle")}
        </h2>
        <p className="max-w-md text-[13px] leading-5 text-muted-foreground">
          {t("emptyStateDescription")}
        </p>
      </div>

      <ol className="flex w-full max-w-lg flex-col gap-3 text-left sm:flex-row sm:gap-4">
        <Step
          icon={Search}
          title={t("stepFindTitle")}
          body={t("stepFindBody")}
        />
        <Step
          icon={Play}
          title={t("stepWatchTitle")}
          body={t("stepWatchBody")}
        />
        <Step
          icon={Network}
          title={t("stepStudyTitle")}
          body={t("stepStudyBody")}
        />
      </ol>

      <button
        type="button"
        onClick={onFocusSearch}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("searchVideos")}
        <ArrowRight className="size-3.5" aria-hidden />
      </button>
    </section>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <li className="flex flex-1 gap-2.5 rounded-md border border-border bg-background px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        <span className="block text-[13px] font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
          {body}
        </span>
      </span>
    </li>
  );
}
