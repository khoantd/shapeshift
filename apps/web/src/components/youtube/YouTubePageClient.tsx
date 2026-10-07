"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ExternalLink,
  Flag,
  LoaderCircle,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import type { VideoBriefTone, VideoTopic } from "@shapeshift/core/jev/videoClassify";
import { ConceptOverlay } from "@/components/youtube/ConceptOverlay";
import { WatchCompanion } from "@/components/youtube/WatchCompanion";
import { YouTubeHomeEmptyState } from "@/components/youtube/YouTubeHomeEmptyState";
import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from "@/components/youtube/YouTubePlayer";
import { YouTubeSearchPanel } from "@/components/youtube/YouTubeSearchPanel";
import {
  YouTubeStudyPanel,
  type StudyTab,
} from "@/components/youtube/YouTubeStudyPanel";
import type { GraphPayload } from "@/lib/neo4j/types";
import { BrandBackdrop } from "@/components/brand/BrandBackdrop";
import { toAiLanguage } from "@/lib/i18n/appLocale";
import { SITE_CHROME_OFFSET_CLASS } from "@/lib/site-chrome";
import { formatYouTubeDuration } from "@/lib/youtube/format";
import type { HistoryPack } from "@/lib/youtube/historyPack";
import {
  activeConceptAt,
  extractKeyConcepts,
} from "@/lib/youtube/learningPackConcepts";
import { resolvePackContentType, type LearningPackLanguage } from "@/lib/youtube/learningPackParse";
import { summarizeLearningPackStats } from "@/lib/youtube/learningPackHistoryStats";
import {
  STUDY_PANEL_DEFAULT_WIDTH,
  clampStudyPanelWidth,
  readStudyPanelWidth,
  studyPanelMaxWidth,
  writeStudyPanelWidth,
} from "@/lib/youtube/studyPanelWidth";
import { extractYouTubeVideoId, looksLikeYouTubeUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/youtube/url";
import type { YouTubeVideo } from "@/lib/youtube/types";

const DEBOUNCE_MS = 400;

type ClassifyView = {
  topic: VideoTopic;
  flagged: boolean;
  needsModeration: number;
  urgency: number;
  relevance: number;
  tone: VideoBriefTone;
  line: string;
  source: "jev" | "mock";
  model?: string | null;
};

type Props = {
  serverConfigured: boolean;
  setupMessage: string | null;
  perplexityConfigured: boolean;
  perplexitySetupMessage: string | null;
  youtubeOAuthClientConfigured: boolean;
  initialOAuthConnected: boolean;
  initialOAuthEmail: string | null;
  initialOAuthHasSub: boolean;
};

type SearchResponse = {
  success: boolean;
  videos?: YouTubeVideo[];
  mode?: "search" | "url";
  error?: { code?: string; message?: string };
};

type DetailsResponse = {
  success: boolean;
  video?: YouTubeVideo;
  error?: { code?: string; message?: string };
};

type ClassifyResponse = ClassifyView & {
  success?: boolean;
  error?: string;
};

type TranscriptResponse = {
  success: boolean;
  status?: string;
  text?: string;
  language?: string | null;
  truncated?: boolean;
  reason?: string;
  message?: string;
  source?:
    | "youtube_data_api"
    | "youtube_transcript"
    | "innertube"
    | "textflow"
    | "serpapi"
    | "timedtext"
    | null;
};

type LearningPackResponse = {
  success: boolean;
  text?: string;
  model?: string | null;
  cached?: boolean;
  contentType?: string;
  language?: string;
  error?: string;
  saved?: boolean;
  historyPackId?: string | null;
  saveError?: string | null;
  graphPayload?: GraphPayload | null;
};

type SummarizeResponse = {
  success: boolean;
  text?: string;
  model?: string | null;
  cached?: boolean;
  language?: string;
  error?: string;
  saved?: boolean;
  saveError?: string | null;
};

type SummarizeGetResponse = {
  success: boolean;
  summaryVi?: string | null;
  summaryEn?: string | null;
  error?: string;
};

type SummaryByLang = Record<LearningPackLanguage, string | null>;

const EMPTY_SUMMARY_BY_LANG: SummaryByLang = { vi: null, en: null };

function topicLabel(topic: VideoTopic): string {
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

/** Parse "- Q: … | A: …" flashcard lines into Anki CSV (front,back). */
function flashcardsToCsv(packMarkdown: string): string | null {
  const lines = packMarkdown.split("\n");
  const rows: string[] = [];
  for (const line of lines) {
    const m = /^\s*[-*]\s*Q:\s*(.+?)\s*\|\s*A:\s*(.+)\s*$/i.exec(line);
    if (!m) continue;
    const front = m[1]!.replace(/"/g, '""').trim();
    const back = m[2]!.replace(/"/g, '""').trim();
    if (front && back) rows.push(`"${front}","${back}"`);
  }
  return rows.length >= 3 ? rows.join("\n") : null;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function YouTubePageClient({
  serverConfigured,
  setupMessage,
  perplexityConfigured,
  perplexitySetupMessage,
  youtubeOAuthClientConfigured,
  initialOAuthConnected,
  initialOAuthEmail,
  initialOAuthHasSub,
}: Props) {
  const listboxId = useId();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selected, setSelected] = useState<YouTubeVideo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [classify, setClassify] = useState<ClassifyView | null>(null);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [, startTransition] = useTransition();

  const [transcript, setTranscript] = useState("");
  const [transcriptBusy, setTranscriptBusy] = useState(false);
  const [transcriptHint, setTranscriptHint] = useState<string | null>(null);
  const [packText, setPackText] = useState<string | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [packMeta, setPackMeta] = useState<{ model?: string | null; cached?: boolean } | null>(
    null,
  );
  const [summaryLang, setSummaryLang] = useState<LearningPackLanguage>(() =>
    toAiLanguage(locale),
  );
  const [summaryByLang, setSummaryByLang] = useState<SummaryByLang>(EMPTY_SUMMARY_BY_LANG);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryMeta, setSummaryMeta] = useState<{ model?: string | null; cached?: boolean } | null>(
    null,
  );
  const [oauthConnected, setOauthConnected] = useState(initialOAuthConnected);
  const [oauthEmail, setOauthEmail] = useState<string | null>(initialOAuthEmail);
  const [oauthHasSub, setOauthHasSub] = useState(initialOAuthHasSub);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [historyPacks, setHistoryPacks] = useState<HistoryPack[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [playbackSec, setPlaybackSec] = useState(0);
  const [studyTab, setStudyTab] = useState<StudyTab>("prepare");
  const [sessionGraphPayload, setSessionGraphPayload] = useState<GraphPayload | null>(null);
  const [searchPanelCollapsed, setSearchPanelCollapsed] = useState(false);
  const [studyPanelCollapsed, setStudyPanelCollapsed] = useState(false);
  const [studyPanelWidth, setStudyPanelWidth] = useState(STUDY_PANEL_DEFAULT_WIDTH);
  // Stable SSR default — real max applied in useEffect after mount (avoids hydration mismatch).
  const [studyPanelMax, setStudyPanelMax] = useState(STUDY_PANEL_DEFAULT_WIDTH);

  const inputRef = useRef<HTMLInputElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const mainSectionRef = useRef<HTMLElement>(null);
  const ytPlayerRef = useRef<YouTubePlayerHandle | null>(null);
  const abortSearchRef = useRef<AbortController | null>(null);
  const abortClassifyRef = useRef<AbortController | null>(null);
  const abortTranscriptRef = useRef<AbortController | null>(null);
  const abortPackRef = useRef<AbortController | null>(null);
  const abortSummaryRef = useRef<AbortController | null>(null);
  const classifyKeyRef = useRef<string>("");
  const transcriptVideoRef = useRef<string>("");
  /** When true, next selected?.videoId effect restores history (keep pack, skip classify/transcript). */
  const historyRestoreRef = useRef(false);

  useEffect(() => {
    setSummaryLang(toAiLanguage(locale));
  }, [locale]);

  const resetPackState = useCallback(() => {
    setTranscript("");
    setTranscriptHint(null);
    setPackText(null);
    setPackError(null);
    setPackMeta(null);
    setSummaryByLang(EMPTY_SUMMARY_BY_LANG);
    setSummaryError(null);
    setSummaryMeta(null);
    setSummaryLang(toAiLanguage(locale));
    setActiveHistoryId(null);
    setSessionGraphPayload(null);
    setStudyTab("prepare");
    abortTranscriptRef.current?.abort();
    abortPackRef.current?.abort();
    abortSummaryRef.current?.abort();
  }, [locale]);

  const scrollMainIntoView = useCallback(() => {
    if (typeof window === "undefined") return;
    // Only scroll on smaller viewports where the aside stacks above the player.
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    requestAnimationFrame(() => {
      mainSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!oauthConnected) {
      setHistoryPacks([]);
      setHistoryError(null);
      return;
    }
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/youtube/learning-packs");
      const body = (await res.json()) as {
        success?: boolean;
        packs?: HistoryPack[];
        error?: string;
      };
      if (!res.ok || !body.success || !body.packs) {
        setHistoryPacks([]);
        if (res.status === 401) {
          setOauthHasSub(false);
          setHistoryError(
            body.error ??
              "Sign out and sign in again to enable history for this Google account.",
          );
        } else {
          setHistoryError(body.error ?? "Could not load history");
        }
        return;
      }
      setOauthHasSub(true);
      setHistoryPacks(
        body.packs.map((pack) => {
          const graphPayload = pack.graphPayload ?? null;
          const stats = summarizeLearningPackStats({
            markdown: pack.markdown,
            graphPayload,
            contentType: pack.contentType,
          });
          return {
            ...pack,
            videoUrl: pack.videoUrl || youtubeWatchUrl(pack.videoId),
            thumbnailUrl:
              pack.thumbnailUrl || youtubeThumbnailUrl(pack.videoId),
            graphPayload,
            contentType: pack.contentType ?? stats.contentType,
            conceptCount:
              typeof pack.conceptCount === "number"
                ? pack.conceptCount
                : stats.conceptCount,
            termCount:
              typeof pack.termCount === "number"
                ? pack.termCount
                : stats.termCount,
          };
        }),
      );
    } catch {
      setHistoryError("Could not load history");
    } finally {
      setHistoryBusy(false);
    }
  }, [oauthConnected]);

  // Heal missing yt_oauth_sub on mount, then load history.
  useEffect(() => {
    if (!oauthConnected) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/youtube/oauth/session");
        const body = (await res.json()) as {
          connected?: boolean;
          email?: string | null;
          hasSub?: boolean;
        };
        if (cancelled) return;
        if (body.connected) setOauthConnected(true);
        if (body.email) setOauthEmail(body.email);
        if (typeof body.hasSub === "boolean") setOauthHasSub(body.hasSub);
      } catch {
        /* keep SSR defaults */
      }
      if (!cancelled) void loadHistory();
    })();
    return () => {
      cancelled = true;
    };
  }, [oauthConnected, loadHistory]);

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < 2 && !extractYouTubeVideoId(q)) {
      setVideos([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    abortSearchRef.current?.abort();
    const ac = new AbortController();
    abortSearchRef.current = ac;
    setSearchBusy(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      });
      const body = (await res.json()) as SearchResponse;
      if (ac.signal.aborted) return;

      if (!body.success) {
        setVideos([]);
        setSearchError(body.error?.message ?? "Search failed");
        setSearchBusy(false);
        return;
      }

      const list = body.videos ?? [];
      setVideos(list);
      setSearchBusy(false);
      setActiveIndex(-1);

      if (body.mode === "url" && list[0]) {
        startTransition(() => {
          setSelected(list[0]!);
          setPlaying(false);
        });
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setVideos([]);
      setSearchBusy(false);
      setSearchError(e instanceof Error ? e.message : "Search failed");
    }
  }, []);

  useEffect(() => {
    if (!serverConfigured) return;
    const q = query.trim();
    if (q.length < 2 && !extractYouTubeVideoId(q)) {
      setVideos([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    const t = window.setTimeout(() => {
      void runSearch(q);
    }, looksLikeYouTubeUrl(q) || extractYouTubeVideoId(q) === q ? 0 : DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [query, runSearch, serverConfigured]);

  const tryFetchTranscript = useCallback(async (videoId: string) => {
    abortTranscriptRef.current?.abort();
    const ac = new AbortController();
    abortTranscriptRef.current = ac;
    transcriptVideoRef.current = videoId;
    setTranscriptBusy(true);
    setTranscriptHint(null);

    try {
      const res = await fetch(
        `/api/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
        { signal: ac.signal },
      );
      const body = (await res.json()) as TranscriptResponse;
      if (ac.signal.aborted || transcriptVideoRef.current !== videoId) return;

      if (body.success && body.text) {
        setTranscript(body.text);
        const via =
          body.source === "youtube_data_api"
            ? "Loaded via YouTube Data API"
            : body.source === "youtube_transcript"
              ? "Loaded via youtube-transcript"
              : body.source === "innertube"
                ? "Loaded via YouTube InnerTube captions"
                : body.source === "textflow"
                  ? "Loaded via TextFlow proxy"
                  : body.source === "serpapi"
                    ? "Loaded via SerpAPI transcript"
                    : body.source === "timedtext"
                      ? "Loaded from captions scrape"
                      : "Captions loaded";
        setTranscriptHint(
          body.truncated ? `${via} (truncated for length).` : `${via}.`,
        );
      } else {
        setTranscriptHint(
          body.message ??
            "Could not fetch captions. Paste the transcript from YouTube (⋯ → Show transcript).",
        );
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setTranscriptHint(
        e instanceof Error
          ? e.message
          : "Could not fetch captions. Paste the transcript instead.",
      );
    } finally {
      if (transcriptVideoRef.current === videoId) setTranscriptBusy(false);
    }
  }, []);

  const loadDetailsAndClassify = useCallback(
    async (video: YouTubeVideo, searchQuery: string, opts?: { classify?: boolean }) => {
      const shouldClassify = opts?.classify !== false;
      setDetailsBusy(true);
      if (shouldClassify) {
        setClassify(null);
        setClassifyError(null);
      }

      let enriched = video;
      try {
        const res = await fetch(
          `/api/youtube/details?videoId=${encodeURIComponent(video.videoId)}`,
        );
        const body = (await res.json()) as DetailsResponse;
        if (body.success && body.video) {
          enriched = body.video;
          setSelected(body.video);
        }
      } catch {
        // Keep search snippet if details fail.
      } finally {
        setDetailsBusy(false);
      }

      if (!shouldClassify) return;

      abortClassifyRef.current?.abort();
      const ac = new AbortController();
      abortClassifyRef.current = ac;
      const key = `${enriched.videoId}::${searchQuery.trim()}`;
      classifyKeyRef.current = key;
      setClassifyBusy(true);

      try {
        const res = await fetch("/api/youtube/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            title: enriched.title,
            description: (enriched.description ?? "").slice(0, 4000),
            query: searchQuery.trim() || undefined,
            channelTitle: enriched.channelTitle,
          }),
        });
        const body = (await res.json()) as ClassifyResponse;
        if (ac.signal.aborted || classifyKeyRef.current !== key) return;

        if (!body.success && body.error) {
          setClassifyError(typeof body.error === "string" ? body.error : "Classification failed");
          setClassifyBusy(false);
          return;
        }

        if (
          body.topic &&
          typeof body.flagged === "boolean" &&
          typeof body.urgency === "number"
        ) {
          setClassify({
            topic: body.topic,
            flagged: body.flagged,
            needsModeration: body.needsModeration ?? 0,
            urgency: body.urgency,
            relevance: body.relevance ?? 0.5,
            tone: body.tone ?? "neutral",
            line: body.line ?? "",
            source: body.source === "jev" ? "jev" : "mock",
            model: body.model ?? null,
          });
        }
        setClassifyBusy(false);
      } catch (e) {
        if (ac.signal.aborted) return;
        setClassifyBusy(false);
        setClassifyError(e instanceof Error ? e.message : "Classification failed");
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    if (historyRestoreRef.current) {
      historyRestoreRef.current = false;
      // Enrich player metadata only — pack already restored from history.
      void loadDetailsAndClassify(selected, "", { classify: false });
      void loadSavedSummaries(selected.videoId);
      return;
    }
    resetPackState();
    const searchQuery = looksLikeYouTubeUrl(query) ? "" : query;
    void loadDetailsAndClassify(selected, searchQuery);
    void tryFetchTranscript(selected.videoId);
    void loadSavedSummaries(selected.videoId);
    // Only re-run when the selected video changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: classify against current query at selection time
  }, [selected?.videoId]);

  const selectVideo = (video: YouTubeVideo) => {
    historyRestoreRef.current = false;
    setPlaybackSec(0);
    setSelected(video);
    setPlaying(false);
    setActiveIndex(-1);
    setStudyTab("prepare");
    scrollMainIntoView();
  };

  const openHistoryPack = (
    item: HistoryPack,
    options?: { studyTab?: StudyTab },
  ) => {
    const sameVideo = selected?.videoId === item.videoId;
    // Only skip classify/transcript when the selection effect will run for a new videoId.
    historyRestoreRef.current = !sameVideo;
    abortClassifyRef.current?.abort();
    abortTranscriptRef.current?.abort();
    abortPackRef.current?.abort();
    abortSummaryRef.current?.abort();
    setClassify(null);
    setClassifyError(null);
    setClassifyBusy(false);
    const savedTranscript = item.transcript?.trim() ?? "";
    setTranscript(savedTranscript);
    setTranscriptBusy(false);
    setTranscriptHint(
      savedTranscript
        ? null
        : "No transcript saved with this pack — fetch or paste to regenerate.",
    );
    setPackText(item.markdown);
    setPackMeta(null);
    setPackBusy(false);
    setPackError(null);
    setSummaryByLang(EMPTY_SUMMARY_BY_LANG);
    setSummaryError(null);
    setSummaryMeta(null);
    setSummaryLang("vi");
    setSummaryBusy(false);
    setActiveHistoryId(item.id);
    setSessionGraphPayload(item.graphPayload);
    setPlaybackSec(0);
    setStudyTab(options?.studyTab ?? "pack");
    if (options?.studyTab === "graph") {
      setStudyPanelCollapsed(false);
    }
    setSelected({
      videoId: item.videoId,
      title: item.videoTitle,
      ...(item.channelTitle ? { channelTitle: item.channelTitle } : {}),
      thumbnailUrl: item.thumbnailUrl || youtubeThumbnailUrl(item.videoId),
    });
    setPlaying(true);
    setActiveIndex(-1);
    scrollMainIntoView();
    if (!savedTranscript) {
      void tryFetchTranscript(item.videoId);
    }
    // Same videoId skips the selected effect — still restore summaries.
    if (sameVideo) {
      void loadSavedSummaries(item.videoId);
    }
  };

  const focusSearch = useCallback(() => {
    setSearchPanelCollapsed(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const onTopicSelect = useCallback(
    (topic: string) => {
      setSearchPanelCollapsed(false);
      setQuery(topic);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!videos.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % videos.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? videos.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectVideo(videos[activeIndex]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveIndex(-1);
    }
  };

  const generateLearningPack = async () => {
    if (!selected) return;
    const text = transcript.trim();
    if (text.length < 80) {
      setPackError("Paste more of the transcript (at least a few spoken lines).");
      return;
    }
    if (!perplexityConfigured) {
      setPackError(perplexitySetupMessage ?? "PERPLEXITY_API_KEY is not set.");
      return;
    }

    abortPackRef.current?.abort();
    const ac = new AbortController();
    abortPackRef.current = ac;
    setPackBusy(true);
    setPackError(null);

    const contentType = resolvePackContentType(classify?.topic);
    const duration = formatYouTubeDuration(selected.duration) ?? undefined;

    try {
      const res = await fetch("/api/youtube/learning-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          videoId: selected.videoId,
          title: selected.title,
          channelTitle: selected.channelTitle,
          contentType,
          transcript: text,
          language: toAiLanguage(locale),
          duration,
        }),
      });
      const body = (await res.json()) as LearningPackResponse;
      if (ac.signal.aborted) return;

      if (!body.success || !body.text) {
        setPackError(body.error ?? "Could not generate learning pack");
        setPackBusy(false);
        return;
      }

      setPackText(body.text);
      setPackMeta({ model: body.model, cached: body.cached });
      setActiveHistoryId(body.historyPackId ?? null);
      setSessionGraphPayload(body.graphPayload ?? null);
      setStudyTab("pack");
      setPackBusy(false);
      if (body.saved) setOauthHasSub(true);
      if (oauthConnected) void loadHistory();
      if (oauthConnected && body.saved === false) {
        setHistoryError(
          body.saveError ??
            "Pack generated but not saved to history. Sign out and sign in again, then regenerate.",
        );
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setPackBusy(false);
      setPackError(e instanceof Error ? e.message : "Could not generate learning pack");
    }
  };

  const summarizeTranscript = async () => {
    if (!selected) return;
    const text = transcript.trim();
    if (text.length < 80) {
      setSummaryError("Paste more of the transcript (at least a few spoken lines).");
      return;
    }
    if (!perplexityConfigured) {
      setSummaryError(perplexitySetupMessage ?? "PERPLEXITY_API_KEY is not set.");
      return;
    }

    abortSummaryRef.current?.abort();
    const ac = new AbortController();
    abortSummaryRef.current = ac;
    setSummaryBusy(true);
    setSummaryError(null);

    const duration = formatYouTubeDuration(selected.duration) ?? undefined;
    const lang = summaryLang;

    try {
      const res = await fetch("/api/youtube/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          videoId: selected.videoId,
          title: selected.title,
          channelTitle: selected.channelTitle,
          transcript: text,
          language: lang,
          duration,
        }),
      });
      const body = (await res.json()) as SummarizeResponse;
      if (ac.signal.aborted) return;

      if (!body.success || !body.text) {
        setSummaryError(body.error ?? "Could not generate summary");
        setSummaryBusy(false);
        return;
      }

      setSummaryByLang((prev) => ({ ...prev, [lang]: body.text! }));
      setSummaryMeta({ model: body.model, cached: body.cached });
      setSummaryBusy(false);
      if (body.saved) setOauthHasSub(true);
      if (oauthConnected && body.saved === false && body.saveError) {
        setHistoryError(body.saveError);
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setSummaryBusy(false);
      setSummaryError(e instanceof Error ? e.message : "Could not generate summary");
    }
  };

  const loadSavedSummaries = useCallback(async (videoId: string) => {
    if (!oauthConnected) return;
    try {
      const res = await fetch(
        `/api/youtube/summarize?videoId=${encodeURIComponent(videoId)}`,
      );
      const body = (await res.json()) as SummarizeGetResponse;
      if (!body.success) return;
      setSummaryByLang({
        vi: body.summaryVi?.trim() || null,
        en: body.summaryEn?.trim() || null,
      });
    } catch {
      // Non-fatal — user can still generate a fresh summary.
    }
  }, [oauthConnected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;
    if (oauth === "connected" || oauth === "connected_no_refresh") {
      setOauthConnected(true);
      void fetch("/api/youtube/oauth/session")
        .then((r) => r.json())
        .then((body: { email?: string | null; connected?: boolean; hasSub?: boolean }) => {
          if (body.connected) setOauthConnected(true);
          if (body.email) setOauthEmail(body.email);
          if (typeof body.hasSub === "boolean") setOauthHasSub(body.hasSub);
        })
        .catch(() => {});
    }
    if (oauth === "signed_out") {
      setOauthConnected(false);
      setOauthEmail(null);
      setOauthHasSub(false);
      setHistoryPacks([]);
    }
    // Clear query noise without full reload
    params.delete("oauth");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, []);

  const signOutYouTube = async () => {
    setOauthBusy(true);
    try {
      await fetch("/api/youtube/oauth/logout", { method: "POST" });
      setOauthConnected(false);
      setOauthEmail(null);
      setOauthHasSub(false);
      setHistoryPacks([]);
      setActiveHistoryId(null);
    } finally {
      setOauthBusy(false);
    }
  };

  const clearSelection = () => {
    setSelected(null);
    setPlaying(false);
    setPlaybackSec(0);
    setClassify(null);
    setClassifyError(null);
    resetPackState();
    setQuery("");
    setVideos([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  // Keep study tab valid when pack/selection changes.
  useEffect(() => {
    if (studyTab === "pack" && !packText) setStudyTab("prepare");
    else if (studyTab === "graph" && (!packText || !selected)) {
      setStudyTab(packText ? "pack" : "prepare");
    } else if (studyTab === "prepare" && !selected && packText) {
      setStudyTab("pack");
    }
  }, [studyTab, packText, selected]);

  const showResultsPanel =
    serverConfigured &&
    (searchBusy || Boolean(searchError) || videos.length > 0 || query.trim().length >= 2);

  const duration = formatYouTubeDuration(selected?.duration);
  const flashcardsCsv = packText ? flashcardsToCsv(packText) : null;
  const canGenerate = transcript.trim().length >= 80 && !packBusy && perplexityConfigured;
  const canSummarize =
    transcript.trim().length >= 80 && !summaryBusy && perplexityConfigured;
  const summaryText = summaryByLang[summaryLang];
  const packDownloadId =
    selected?.videoId ??
    historyPacks.find((p) => p.id === activeHistoryId)?.videoId ??
    "learning-pack";
  const selectedWatchUrl = selected ? youtubeWatchUrl(selected.videoId) : null;
  const packConcepts = useMemo(
    () => (packText ? extractKeyConcepts(packText) : []),
    [packText],
  );
  const activeConcept =
    playing && packConcepts.length > 0
      ? activeConceptAt(packConcepts, playbackSec)
      : null;
  const conceptUpcoming =
    activeConcept != null && playbackSec < activeConcept.startSec;

  // SSR + first client paint use false; sync to viewport after mount (avoids hydration mismatch).
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const applyViewport = () => {
      const max = studyPanelMaxWidth(window.innerWidth);
      setStudyPanelMax(max);
      setStudyPanelWidth((prev) => clampStudyPanelWidth(prev, max));
    };
    const stored = readStudyPanelWidth();
    const max = studyPanelMaxWidth(window.innerWidth);
    setStudyPanelMax(max);
    setStudyPanelWidth(
      clampStudyPanelWidth(stored ?? STUDY_PANEL_DEFAULT_WIDTH, max),
    );
    window.addEventListener("resize", applyViewport);
    return () => window.removeEventListener("resize", applyViewport);
  }, []);

  const onStudyWidthChange = useCallback(
    (next: number) => {
      setStudyPanelWidth(clampStudyPanelWidth(next, studyPanelMax));
    },
    [studyPanelMax],
  );

  const onStudyWidthCommit = useCallback(
    (next: number) => {
      const clamped = clampStudyPanelWidth(next, studyPanelMax);
      setStudyPanelWidth(clamped);
      writeStudyPanelWidth(clamped);
    },
    [studyPanelMax],
  );

  const showStudy = Boolean(selected || packText);

  const searchPanelProps = {
    collapsed: searchPanelCollapsed,
    onCollapsedChange: setSearchPanelCollapsed,
    listboxId,
    inputRef,
    historySectionRef,
    serverConfigured,
    setupMessage,
    youtubeOAuthClientConfigured,
    query,
    onQueryChange: setQuery,
    onKeyDown,
    onClear: clearSelection,
    videos,
    selected,
    activeIndex,
    searchBusy,
    searchError,
    showResultsPanel,
    onSelectVideo: selectVideo,
    oauthConnected,
    oauthEmail,
    oauthHasSub,
    oauthBusy,
    onSignOut: () => void signOutYouTube(),
    historyPacks,
    historyBusy,
    historyError,
    activeHistoryId,
    onOpenHistoryPack: openHistoryPack,
  };

  const studyPanelProps = {
    collapsed: studyPanelCollapsed,
    onCollapsedChange: setStudyPanelCollapsed,
    width: studyPanelWidth,
    maxWidth: studyPanelMax,
    onWidthChange: onStudyWidthChange,
    onWidthCommit: onStudyWidthCommit,
    studyTab,
    onStudyTabChange: setStudyTab,
    selectedVideoId: selected?.videoId ?? null,
    selectedTitle: selected?.title ?? null,
    selectedChannelTitle: selected?.channelTitle,
    contentType: resolvePackContentType(classify?.topic),
    transcript,
    onTranscriptChange: setTranscript,
    transcriptBusy,
    transcriptHint,
    onRetryTranscript: () => {
      if (selected) void tryFetchTranscript(selected.videoId);
    },
    packText,
    packBusy,
    packError,
    packMeta,
    canGenerate,
    onGeneratePack: () => void generateLearningPack(),
    summaryLang,
    onSummaryLangChange: setSummaryLang,
    summaryText,
    summaryBusy,
    summaryError,
    summaryMeta,
    canSummarize,
    onSummarize: () => void summarizeTranscript(),
    perplexityConfigured,
    perplexitySetupMessage,
    packDownloadId,
    flashcardsCsv,
    onDownloadText: downloadText,
    playbackSec,
    sessionGraphPayload,
    historyPackId: activeHistoryId,
    onGraphReady: (graph: GraphPayload) => {
      setSessionGraphPayload(graph);
      if (activeHistoryId) {
        setHistoryPacks((prev) =>
          prev.map((p) =>
            p.id === activeHistoryId ? { ...p, graphPayload: graph } : p,
          ),
        );
      }
    },
    onSeek: (sec: number) => {
      setPlaying(true);
      ytPlayerRef.current?.seekTo(sec);
      setPlaybackSec(sec);
    },
  };

  const openStudy = useCallback((tab?: StudyTab) => {
    setStudyPanelCollapsed(false);
    if (tab) setStudyTab(tab);
  }, []);

  const seekFromCompanion = useCallback((sec: number) => {
    setPlaying(true);
    ytPlayerRef.current?.seekTo(sec);
    setPlaybackSec(sec);
  }, []);

  return (
    <div
      className={`flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden ${SITE_CHROME_OFFSET_CLASS}`}
    >
      {isLg ? (
        <YouTubeSearchPanel variant="sidebar" {...searchPanelProps} />
      ) : (
        <YouTubeSearchPanel variant="stacked" {...searchPanelProps} />
      )}

      <div className="relative z-0 flex min-h-[45vh] flex-1 flex-col lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <section
          ref={mainSectionRef}
          className="relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/40"
          aria-label={selected || packText ? "Video player" : "Watch or home"}
        >
          <BrandBackdrop src="/brand/main.jpg" scrub="light" position="center top" />
          {!selected && !packText && (
            <div className="relative z-[1] min-h-0 flex-1">
            <YouTubeHomeEmptyState
              historyPacks={historyPacks}
              historyBusy={historyBusy}
              onOpenPack={(item) => openHistoryPack(item)}
              onOpenGraph={(item) =>
                openHistoryPack(item, { studyTab: "graph" })
              }
              onTopicSelect={onTopicSelect}
              onFocusSearch={focusSearch}
            />
            </div>
          )}

          {(selected || packText) && (
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
              {selected && (
                <div className="relative z-[1] shrink-0 border-b border-border bg-background/60">
                  <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:max-w-4xl sm:px-6 lg:max-w-none lg:px-8">
                    <div className="relative isolate overflow-hidden rounded-md border border-border bg-black">
                      {playing ? (
                        <>
                          <YouTubePlayer
                            key={selected.videoId}
                            videoId={selected.videoId}
                            title={selected.title}
                            playerRef={ytPlayerRef}
                            onTimeUpdate={setPlaybackSec}
                          />
                          {activeConcept && (
                            <ConceptOverlay
                              key={activeConcept.id}
                              concept={activeConcept}
                              upcoming={conceptUpcoming}
                              onSeek={(sec) => {
                                ytPlayerRef.current?.seekTo(sec);
                                setPlaybackSec(sec);
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPlaybackSec(0);
                            setPlaying(true);
                          }}
                          className="group relative aspect-video w-full cursor-pointer bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          aria-label={`Play ${selected.title}`}
                        >
                          {selected.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selected.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-150 group-hover:bg-black/35">
                            <span className="flex size-14 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm transition-transform duration-150 group-hover:scale-105">
                              <Play className="size-6 ms-0.5" aria-hidden />
                            </span>
                          </span>
                        </button>
                      )}
                    </div>

                    {packText && (
                      <p
                        className="mt-2 text-[12px] text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        {packConcepts.length > 0
                          ? `${packConcepts.length} key concept${packConcepts.length === 1 ? "" : "s"} — overlay while playing; also in Graph`
                          : "No timed key concepts in pack — regenerate for overlay"}
                      </p>
                    )}

                    <div className="flex items-start justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <h2 className="text-[17px] leading-6 font-[550] text-pretty break-words text-foreground">
                          {selected.title}
                        </h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                          {selected.channelTitle && <span>{selected.channelTitle}</span>}
                          {duration && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{duration}</span>
                            </>
                          )}
                          {detailsBusy && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1">
                                <LoaderCircle className="size-3 animate-spin" aria-hidden />
                                Details…
                              </span>
                            </>
                          )}
                        </p>
                        {selectedWatchUrl && (
                          <a
                            href={selectedWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex max-w-full cursor-pointer items-center gap-1 truncate text-[12px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">Open on YouTube</span>
                          </a>
                        )}

                        <div
                          className="mt-2.5 flex flex-wrap items-center gap-2"
                          aria-live="polite"
                          aria-busy={classifyBusy}
                        >
                          {classifyBusy && !classify && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <LoaderCircle className="size-3 animate-spin" aria-hidden />
                              Classifying…
                            </span>
                          )}
                          {classifyError && !classify && (
                            <span className="text-[12px] text-destructive" role="alert">
                              {classifyError}
                            </span>
                          )}
                          {classify && (
                            <>
                              <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2 text-[12px] font-medium text-ink-2">
                                {topicLabel(classify.topic)}
                              </span>
                              <span
                                className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium ${
                                  classify.flagged
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-secondary text-ink-2"
                                }`}
                              >
                                {classify.flagged ? (
                                  <Flag className="size-3" aria-hidden />
                                ) : (
                                  <ShieldCheck className="size-3" aria-hidden />
                                )}
                                {classify.flagged ? "Flag" : "OK"}
                              </span>
                              {classify.line && (
                                <span className="line-clamp-1 max-w-full text-[12px] text-muted-foreground">
                                  {classify.line}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelection}
                        aria-label="Close video"
                        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>

                    <WatchCompanion
                      packText={packText}
                      packBusy={packBusy}
                      canGenerate={canGenerate}
                      onGeneratePack={() => void generateLearningPack()}
                      summaryText={summaryText ?? null}
                      summaryBusy={summaryBusy}
                      summaryLang={summaryLang}
                      onSummaryLangChange={setSummaryLang}
                      canSummarize={canSummarize}
                      onSummarize={() => void summarizeTranscript()}
                      perplexityConfigured={perplexityConfigured}
                      concepts={packConcepts}
                      playbackSec={playbackSec}
                      graphPayload={sessionGraphPayload}
                      onSeek={seekFromCompanion}
                      onOpenStudy={openStudy}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {showStudy &&
          (isLg ? (
            <YouTubeStudyPanel variant="sidebar" {...studyPanelProps} />
          ) : (
            <YouTubeStudyPanel variant="stacked" {...studyPanelProps} />
          ))}
      </div>
    </div>
  );
}
