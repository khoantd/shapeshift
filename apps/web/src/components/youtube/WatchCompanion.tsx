"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LoaderCircle,
  Network,
  PanelRightOpen,
} from "lucide-react";
import type { LearningPackLanguage } from "@/lib/youtube/learningPackParse";
import type { LearningPackConcept } from "@/lib/youtube/learningPackConcepts";
import { activeConceptAt } from "@/lib/youtube/learningPackConcepts";
import {
  resolveWatchTldr,
  watchCompanionGraphStats,
  watchCompanionPhase,
} from "@/lib/youtube/watchCompanion";
import type { GraphPayload } from "@/lib/neo4j/types";
import type { StudyTab } from "@/components/youtube/YouTubeStudyPanel";

type Props = {
  packText: string | null;
  packBusy: boolean;
  canGenerate: boolean;
  onGeneratePack: () => void;
  summaryText: string | null;
  summaryBusy: boolean;
  summaryLang: LearningPackLanguage;
  onSummaryLangChange: (lang: LearningPackLanguage) => void;
  canSummarize: boolean;
  onSummarize: () => void;
  perplexityConfigured: boolean;
  concepts: LearningPackConcept[];
  playbackSec: number;
  graphPayload: GraphPayload | null;
  onSeek: (sec: number) => void;
  onOpenStudy: (tab?: StudyTab) => void;
};

export function WatchCompanion({
  packText,
  packBusy,
  canGenerate,
  onGeneratePack,
  summaryText,
  summaryBusy,
  summaryLang,
  onSummaryLangChange,
  canSummarize,
  onSummarize,
  perplexityConfigured,
  concepts,
  playbackSec,
  graphPayload,
  onSeek,
  onOpenStudy,
}: Props) {
  const t = useTranslations("YouTube");
  const phase = watchCompanionPhase({ packText, summaryText });
  const tldr = resolveWatchTldr({ summaryText, packMarkdown: packText });
  const graphStats = watchCompanionGraphStats({
    packMarkdown: packText,
    graphPayload,
  });
  const active = concepts.length > 0 ? activeConceptAt(concepts, playbackSec) : null;
  const [tldrExpanded, setTldrExpanded] = useState(false);

  return (
    <section
      className="mt-2 border-t border-border pt-4 pb-6"
      aria-label={t("watchCompanion")}
    >
      {phase === "empty" ? (
        <EmptyCompanion
          packBusy={packBusy}
          canGenerate={canGenerate}
          onGeneratePack={onGeneratePack}
          summaryBusy={summaryBusy}
          summaryLang={summaryLang}
          onSummaryLangChange={onSummaryLangChange}
          canSummarize={canSummarize}
          onSummarize={onSummarize}
          perplexityConfigured={perplexityConfigured}
          onOpenStudy={() => onOpenStudy("prepare")}
        />
      ) : (
        <ReadyCompanion
          tldr={tldr}
          tldrExpanded={tldrExpanded}
          onToggleTldr={() => setTldrExpanded((v) => !v)}
          hasPack={Boolean(packText?.trim())}
          concepts={concepts}
          activeId={active?.id ?? null}
          graphStats={graphStats}
          packBusy={packBusy}
          canGenerate={canGenerate}
          onGeneratePack={onGeneratePack}
          onSeek={onSeek}
          onOpenStudy={onOpenStudy}
        />
      )}
    </section>
  );
}

function EmptyCompanion({
  packBusy,
  canGenerate,
  onGeneratePack,
  summaryBusy,
  summaryLang,
  onSummaryLangChange,
  canSummarize,
  onSummarize,
  perplexityConfigured,
  onOpenStudy,
}: {
  packBusy: boolean;
  canGenerate: boolean;
  onGeneratePack: () => void;
  summaryBusy: boolean;
  summaryLang: LearningPackLanguage;
  onSummaryLangChange: (lang: LearningPackLanguage) => void;
  canSummarize: boolean;
  onSummarize: () => void;
  perplexityConfigured: boolean;
  onOpenStudy: () => void;
}) {
  const t = useTranslations("YouTube");
  return (
    <div>
      <h3 className="text-[15px] font-[550] leading-5 text-foreground">
        Turn this lecture into study materials
      </h3>
      <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{t("companionHint")}</p>

      {!perplexityConfigured && (
        <p className="mt-3 text-[13px] text-muted-foreground" role="status">
          Set PERPLEXITY_API_KEY to generate packs and summaries.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canGenerate}
          onClick={onGeneratePack}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {packBusy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <BookOpen className="size-3.5" aria-hidden />
          )}
          {packBusy ? t("generating") : t("generatePack")}
        </button>

        <div className="inline-flex items-center gap-1">
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="group"
            aria-label={t("summaryLanguage")}
          >
            {(
              [
                { id: "vi" as const, label: "VN" },
                { id: "en" as const, label: "EN" },
              ] as const
            ).map((opt) => {
              const active = summaryLang === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSummaryLangChange(opt.id)}
                  className={`inline-flex h-7 cursor-pointer items-center rounded px-2 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canSummarize}
            onClick={onSummarize}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summaryBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ClipboardList className="size-3.5" aria-hidden />
            )}
            {summaryBusy ? t("summarizing") : t("summarize")}
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenStudy}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <PanelRightOpen className="size-3.5" aria-hidden />
          {t("openStudy")}
        </button>
      </div>
    </div>
  );
}

function ReadyCompanion({
  tldr,
  tldrExpanded,
  onToggleTldr,
  hasPack,
  concepts,
  activeId,
  graphStats,
  packBusy,
  canGenerate,
  onGeneratePack,
  onSeek,
  onOpenStudy,
}: {
  tldr: string | null;
  tldrExpanded: boolean;
  onToggleTldr: () => void;
  hasPack: boolean;
  concepts: LearningPackConcept[];
  activeId: string | null;
  graphStats: { conceptCount: number; termCount: number } | null;
  packBusy: boolean;
  canGenerate: boolean;
  onGeneratePack: () => void;
  onSeek: (sec: number) => void;
  onOpenStudy: (tab?: StudyTab) => void;
}) {
  const t = useTranslations("YouTube");
  return (
    <div className="flex flex-col gap-5">
      {tldr && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-medium text-foreground">TL;DR</h3>
            <div className="flex items-center gap-2">
              {hasPack && (
                <button
                  type="button"
                  onClick={() => onOpenStudy("pack")}
                  className="cursor-pointer text-[12px] font-medium text-muted-foreground underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Open Pack
                </button>
              )}
              <button
                type="button"
                onClick={onToggleTldr}
                aria-expanded={tldrExpanded}
                className="inline-flex cursor-pointer items-center gap-0.5 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {tldrExpanded ? (
                  <>
                    Less
                    <ChevronUp className="size-3.5" aria-hidden />
                  </>
                ) : (
                  <>
                    More
                    <ChevronDown className="size-3.5" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
          <p
            className={`text-[14px] leading-6 text-pretty text-ink-2 ${
              tldrExpanded ? "" : "line-clamp-3"
            }`}
          >
            {tldr}
          </p>
        </div>
      )}

      {!hasPack && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGeneratePack}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {packBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <BookOpen className="size-3.5" aria-hidden />
            )}
            {packBusy ? t("generating") : t("generatePack")}
          </button>
          <button
            type="button"
            onClick={() => onOpenStudy("prepare")}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PanelRightOpen className="size-3.5" aria-hidden />
            {t("openStudy")}
          </button>
        </div>
      )}

      {concepts.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-medium text-foreground">
              Key moments
            </h3>
            <span className="text-[12px] text-muted-foreground">
              {concepts.length} concept{concepts.length === 1 ? "" : "s"}
            </span>
          </div>
          <ol className="flex flex-col gap-0.5" aria-label={t("keyMoments")}>
            {concepts.map((concept) => {
              const isActive = concept.id === activeId;
              return (
                <li key={concept.id}>
                  <button
                    type="button"
                    onClick={() => onSeek(concept.startSec)}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-ink-2 hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 font-mono text-[12px] tabular-nums ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {concept.timestampLabel.replace(/^\[|\]$/g, "")}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-5 text-pretty">
                      {concept.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {graphStats && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-[13px] text-ink-2">
            <span className="font-medium text-foreground">
              {graphStats.conceptCount}
            </span>{" "}
            concept{graphStats.conceptCount === 1 ? "" : "s"}
            <span aria-hidden> · </span>
            <span className="font-medium text-foreground">
              {graphStats.termCount}
            </span>{" "}
            term{graphStats.termCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => onOpenStudy("graph")}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Network className="size-3.5" aria-hidden />
            Open Graph
          </button>
        </div>
      )}

      {!tldr && concepts.length === 0 && !graphStats && hasPack && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-ink-2">{t("packReady")}</p>
          <button
            type="button"
            onClick={() => onOpenStudy("pack")}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BookOpen className="size-3.5" aria-hidden />
            Open Pack
          </button>
        </div>
      )}
    </div>
  );
}
