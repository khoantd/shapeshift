"use client";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  LoaderCircle,
  Network,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { Resizable } from "re-resizable";
import { KnowledgeGraphPanel } from "@/components/youtube/knowledge-graph/KnowledgeGraphPanel";
import { LearningPackPreview } from "@/components/youtube/LearningPackPreview";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { PanelRailButton } from "@/components/youtube/panel-rail";
import type { GraphPayload } from "@/lib/neo4j/types";
import type { LearningPackLanguage } from "@/lib/youtube/learningPackParse";
import {
  STUDY_PANEL_DEFAULT_WIDTH,
  STUDY_PANEL_MIN_WIDTH,
  STUDY_PANEL_WIDTH_STEP,
  clampStudyPanelWidth,
} from "@/lib/youtube/studyPanelWidth";

export type StudyTab = "prepare" | "pack" | "graph";

type Props = {
  variant: "sidebar" | "stacked";
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Desktop sidebar width in px (ignored when collapsed or stacked). */
  width?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  onWidthCommit?: (width: number) => void;
  className?: string;
  studyTab: StudyTab;
  onStudyTabChange: (tab: StudyTab) => void;
  selectedVideoId: string | null;
  selectedTitle: string | null;
  selectedChannelTitle?: string;
  contentType?: string;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  transcriptBusy: boolean;
  transcriptHint: string | null;
  onRetryTranscript: () => void;
  packText: string | null;
  packBusy: boolean;
  packError: string | null;
  packMeta: { model?: string | null; cached?: boolean } | null;
  canGenerate: boolean;
  onGeneratePack: () => void;
  summaryLang: LearningPackLanguage;
  onSummaryLangChange: (lang: LearningPackLanguage) => void;
  summaryText: string | null;
  summaryBusy: boolean;
  summaryError: string | null;
  summaryMeta: { model?: string | null; cached?: boolean } | null;
  canSummarize: boolean;
  onSummarize: () => void;
  perplexityConfigured: boolean;
  perplexitySetupMessage: string | null;
  packDownloadId: string;
  flashcardsCsv: string | null;
  onDownloadText: (filename: string, content: string, mime: string) => void;
  playbackSec: number;
  sessionGraphPayload: GraphPayload | null;
  historyPackId: string | null;
  onGraphReady: (graph: GraphPayload) => void;
  onSeek: (sec: number) => void;
};

function downloadFlashcards(
  onDownloadText: Props["onDownloadText"],
  packDownloadId: string,
  csv: string,
) {
  onDownloadText(`${packDownloadId}-flashcards.csv`, csv, "text/csv;charset=utf-8");
}

export function YouTubeStudyPanel({
  variant,
  collapsed,
  onCollapsedChange,
  width = STUDY_PANEL_DEFAULT_WIDTH,
  maxWidth = STUDY_PANEL_DEFAULT_WIDTH,
  onWidthChange,
  onWidthCommit,
  className = "",
  studyTab,
  onStudyTabChange,
  selectedVideoId,
  selectedTitle,
  selectedChannelTitle,
  contentType,
  transcript,
  onTranscriptChange,
  transcriptBusy,
  transcriptHint,
  onRetryTranscript,
  packText,
  packBusy,
  packError,
  packMeta,
  canGenerate,
  onGeneratePack,
  summaryLang,
  onSummaryLangChange,
  summaryText,
  summaryBusy,
  summaryError,
  summaryMeta,
  canSummarize,
  onSummarize,
  perplexityConfigured,
  perplexitySetupMessage,
  packDownloadId,
  flashcardsCsv,
  onDownloadText,
  playbackSec,
  sessionGraphPayload,
  historyPackId,
  onGraphReady,
  onSeek,
}: Props) {
  const hasSelected = Boolean(selectedVideoId);
  const expand = () => onCollapsedChange(false);
  const collapse = () => onCollapsedChange(true);
  const panelWidth = clampStudyPanelWidth(width, maxWidth);

  const applyWidth = (next: number, commit: boolean) => {
    const clamped = clampStudyPanelWidth(next, maxWidth);
    onWidthChange?.(clamped);
    if (commit) onWidthCommit?.(clamped);
  };

  const onResizeHandleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = panelWidth + STUDY_PANEL_WIDTH_STEP;
    else if (e.key === "ArrowRight") next = panelWidth - STUDY_PANEL_WIDTH_STEP;
    else if (e.key === "Home") next = STUDY_PANEL_MIN_WIDTH;
    else if (e.key === "End") next = maxWidth;
    if (next == null) return;
    e.preventDefault();
    applyWidth(next, true);
  };

  const tabs = [
    {
      id: "prepare" as const,
      label: "Prepare",
      icon: ClipboardList,
      enabled: hasSelected,
    },
    { id: "pack" as const, label: "Pack", icon: BookOpen, enabled: !!packText },
    {
      id: "graph" as const,
      label: "Graph",
      icon: Network,
      enabled: !!(packText && hasSelected),
    },
  ] as const;

  const selectTab = (id: StudyTab) => {
    onStudyTabChange(id);
    if (collapsed) expand();
  };

  if (collapsed) {
    if (variant === "sidebar") {
      return (
        <aside
          className={`relative z-10 hidden h-full w-12 shrink-0 flex-col items-center gap-2 overflow-hidden border-l border-border bg-background/50 py-3 lg:flex ${className}`}
          aria-label="Study panel collapsed"
        >
          <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="right top" />
          <div className="relative z-[1] flex flex-col items-center gap-2">
          <PanelRailButton
            label="Show study panel"
            onClick={expand}
            icon={ChevronLeft}
          />
          <div className="my-1 h-px w-6 bg-border" aria-hidden />
          {tabs.map((tab) => (
            <PanelRailButton
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              pressed={studyTab === tab.id}
              disabled={!tab.enabled}
              onClick={() => selectTab(tab.id)}
            />
          ))}
          </div>
        </aside>
      );
    }
    return (
      <div
        className={`relative flex w-full items-center gap-1 overflow-hidden border-t border-border bg-background/50 px-2 py-1.5 lg:hidden ${className}`}
        aria-label="Study panel collapsed"
      >
        <BrandBackdrop src="/brand/header.jpg" scrub="medium" position="center" />
        <button
          type="button"
          onClick={expand}
          className="relative z-[1] inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Show study
        </button>
        {tabs.map((tab) => (
          <PanelRailButton
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            pressed={studyTab === tab.id}
            disabled={!tab.enabled}
            onClick={() => selectTab(tab.id)}
          />
        ))}
      </div>
    );
  }

  const shellClass =
    variant === "sidebar"
      ? `relative z-10 flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background/50 ${className}`
      : `relative z-10 flex max-h-[min(55vh,28rem)] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background/50 lg:hidden ${className}`;

  const panelInner = (
    <>
      <BrandBackdrop src="/brand/main.jpg" scrub="medium" position="right center" />
      <div className="relative z-[1] flex shrink-0 items-center gap-1 border-b border-border px-2">
        <div
          className="flex min-w-0 flex-1"
          role="tablist"
          aria-label="Study materials"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = studyTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`study-tab-${variant}-${tab.id}`}
                aria-selected={active}
                aria-controls={`study-panel-${variant}-${tab.id}`}
                disabled={!tab.enabled}
                onClick={() => selectTab(tab.id)}
                className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 ${
                  active
                    ? "border-b-2 border-foreground text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate max-sm:sr-only">{tab.label}</span>
              </button>
            );
          })}
        </div>
        {variant === "sidebar" ? (
          <button
            type="button"
            onClick={collapse}
            aria-label="Hide study panel"
            aria-expanded
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:size-8"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={collapse}
            aria-label="Hide study panel"
            aria-expanded
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md px-3 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-8 sm:min-h-0 sm:px-2"
          >
            Hide
          </button>
        )}
      </div>

      <div
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-3 py-3"
        aria-busy={packBusy || transcriptBusy || summaryBusy}
      >
        {studyTab === "prepare" && hasSelected && (
          <div
            role="tabpanel"
            id={`study-panel-${variant}-prepare`}
            aria-labelledby={`study-tab-${variant}-prepare`}
          >
            <p className="mb-3 text-[13px] leading-5 text-ink-2">
              Confirm or paste the transcript, then generate a study pack.
            </p>

            {!perplexityConfigured && (
              <p className="mb-3 text-[13px] text-muted-foreground" role="status">
                {perplexitySetupMessage ?? "Set PERPLEXITY_API_KEY to generate packs."}
              </p>
            )}

            <label
              htmlFor="youtube-transcript"
              className="mb-1.5 block text-[13px] font-medium text-foreground"
            >
              Transcript
            </label>
            <textarea
              id="youtube-transcript"
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="Paste captions here…"
              className="mb-2 w-full cursor-text resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-[13px] leading-5 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            {transcriptBusy && (
              <p
                className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground"
                aria-live="polite"
              >
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                Fetching captions…
              </p>
            )}
            {transcriptHint && !transcriptBusy && (
              <p className="mb-2 text-[13px] text-muted-foreground">{transcriptHint}</p>
            )}

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
                {packBusy ? "Generating…" : "Generate learning pack"}
              </button>
              <button
                type="button"
                disabled={transcriptBusy}
                onClick={onRetryTranscript}
                className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry caption fetch
              </button>
            </div>

            {packError && (
              <p className="mt-3 text-[14px] text-destructive" role="alert">
                {packError}
              </p>
            )}

            {packText && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Pack ready — switch to{" "}
                <button
                  type="button"
                  onClick={() => selectTab("pack")}
                  className="cursor-pointer font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                >
                  Pack
                </button>{" "}
                or{" "}
                <button
                  type="button"
                  onClick={() => selectTab("graph")}
                  className="cursor-pointer font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                >
                  Graph
                </button>
                .
              </p>
            )}

            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-medium text-foreground">Summarization</h3>
                <div
                  className="inline-flex rounded-md border border-border p-0.5"
                  role="group"
                  aria-label="Summary language"
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
                        className={`inline-flex h-7 cursor-pointer items-center rounded px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                          active
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mb-3 text-[13px] leading-5 text-ink-2">
                Short recap from the transcript above ({summaryLang === "vi" ? "Vietnamese" : "English"}).
              </p>
              <button
                type="button"
                disabled={!canSummarize}
                onClick={onSummarize}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {summaryBusy ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <FileText className="size-3.5" aria-hidden />
                )}
                {summaryBusy ? "Summarizing…" : "Summarize"}
              </button>
              {summaryError && (
                <p className="mt-3 text-[14px] text-destructive" role="alert">
                  {summaryError}
                </p>
              )}
              {summaryText && (
                <div className="mt-3">
                  {summaryMeta?.model && (
                    <p className="mb-2 text-[12px] text-muted-foreground">
                      {summaryMeta.cached ? "Cached · " : ""}
                      {summaryMeta.model}
                    </p>
                  )}
                  <LearningPackPreview markdown={summaryText} />
                </div>
              )}
            </div>
          </div>
        )}

        {studyTab === "pack" && packText && (
          <div role="tabpanel" id={`study-panel-${variant}-pack`} aria-labelledby={`study-tab-${variant}-pack`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onDownloadText(
                    `${packDownloadId}-learning-pack.md`,
                    packText,
                    "text/markdown;charset=utf-8",
                  )
                }
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Download className="size-3.5" aria-hidden />
                Download .md
              </button>
              {flashcardsCsv && (
                <button
                  type="button"
                  onClick={() =>
                    downloadFlashcards(onDownloadText, packDownloadId, flashcardsCsv)
                  }
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Download className="size-3.5" aria-hidden />
                  Flashcards CSV
                </button>
              )}
              {packMeta?.model && (
                <span className="text-[12px] text-muted-foreground">
                  {packMeta.cached ? "Cached · " : ""}
                  {packMeta.model}
                </span>
              )}
            </div>
            <LearningPackPreview markdown={packText} />
          </div>
        )}

        {studyTab === "graph" && packText && hasSelected && selectedVideoId && selectedTitle && (
          <div
            role="tabpanel"
            id={`study-panel-${variant}-graph`}
            aria-labelledby={`study-tab-${variant}-graph`}
          >
            <KnowledgeGraphPanel
              key={`${selectedVideoId}-${historyPackId ?? "live"}`}
              embedded
              layout="sidebar"
              videoId={selectedVideoId}
              title={selectedTitle}
              channelTitle={selectedChannelTitle}
              contentType={contentType}
              markdown={packText}
              playbackSec={playbackSec}
              initialGraph={sessionGraphPayload}
              historyPackId={historyPackId}
              onGraphReady={onGraphReady}
              onSeek={onSeek}
            />
          </div>
        )}

        {studyTab === "prepare" && !hasSelected && packText && (
          <div
            role="tabpanel"
            id={`study-panel-${variant}-prepare`}
            aria-labelledby={`study-tab-${variant}-prepare`}
            className="py-6 text-center text-[13px] text-muted-foreground"
          >
            Select a video to prepare a new pack, or open{" "}
            <button
              type="button"
              onClick={() => selectTab("pack")}
              className="cursor-pointer font-medium text-foreground underline decoration-border underline-offset-2"
            >
              Pack
            </button>
            .
          </div>
        )}
      </div>
    </>
  );

  if (variant === "sidebar") {
    return (
      <Resizable
        size={{ width: panelWidth, height: "100%" }}
        minWidth={STUDY_PANEL_MIN_WIDTH}
        maxWidth={maxWidth}
        enable={{
          top: false,
          right: false,
          bottom: false,
          left: true,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
        onResize={(_e, _dir, ref) => {
          const next = Number.parseInt(ref.style.width, 10);
          if (Number.isFinite(next)) applyWidth(next, false);
        }}
        onResizeStop={(_e, _dir, ref) => {
          const next = Number.parseInt(ref.style.width, 10);
          if (Number.isFinite(next)) applyWidth(next, true);
        }}
        handleClasses={{
          left: "!w-1.5 !-left-0.5 z-20",
        }}
        handleComponent={{
          left: (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize study panel"
              aria-valuenow={panelWidth}
              aria-valuemin={STUDY_PANEL_MIN_WIDTH}
              aria-valuemax={maxWidth}
              tabIndex={0}
              onKeyDown={onResizeHandleKeyDown}
              className="group absolute inset-y-0 left-0 flex w-1.5 cursor-col-resize items-stretch justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span
                className="w-px bg-transparent transition-colors duration-150 group-hover:bg-border group-focus-visible:bg-ring"
                aria-hidden
              />
            </div>
          ),
        }}
        className={shellClass}
      >
        <aside className="flex h-full min-h-0 w-full flex-col" aria-label="Study materials">
          {panelInner}
        </aside>
      </Resizable>
    );
  }

  return (
    <aside className={shellClass} aria-label="Study materials">
      {panelInner}
    </aside>
  );
}
