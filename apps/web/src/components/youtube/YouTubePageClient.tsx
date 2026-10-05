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
  BookOpen,
  Download,
  ExternalLink,
  Flag,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Play,
  Search,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import type { VideoBriefTone, VideoTopic } from "@shapeshift/core/jev/videoClassify";
import { ConceptOverlay } from "@/components/youtube/ConceptOverlay";
import { LearningPackPreview } from "@/components/youtube/LearningPackPreview";
import {
  YouTubePlayer,
  type YouTubePlayerHandle,
} from "@/components/youtube/YouTubePlayer";
import { SITE_CHROME_OFFSET_CLASS } from "@/lib/site-chrome";
import { formatYouTubeDuration } from "@/lib/youtube/format";
import {
  activeConceptAt,
  extractKeyConcepts,
} from "@/lib/youtube/learningPackConcepts";
import { resolvePackContentType } from "@/lib/youtube/learningPackParse";
import { extractYouTubeVideoId, looksLikeYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube/url";
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
};

type HistoryPack = {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  channelTitle: string | null;
  markdown: string;
  transcript: string | null;
  createdAt: number;
};

function formatRelativeTime(ms: number): string {
  const delta = Date.now() - ms;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

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
  const [oauthConnected, setOauthConnected] = useState(initialOAuthConnected);
  const [oauthEmail, setOauthEmail] = useState<string | null>(initialOAuthEmail);
  const [oauthHasSub, setOauthHasSub] = useState(initialOAuthHasSub);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [historyPacks, setHistoryPacks] = useState<HistoryPack[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [playbackSec, setPlaybackSec] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const ytPlayerRef = useRef<YouTubePlayerHandle | null>(null);
  const abortSearchRef = useRef<AbortController | null>(null);
  const abortClassifyRef = useRef<AbortController | null>(null);
  const abortTranscriptRef = useRef<AbortController | null>(null);
  const abortPackRef = useRef<AbortController | null>(null);
  const classifyKeyRef = useRef<string>("");
  const transcriptVideoRef = useRef<string>("");
  /** When true, next selected?.videoId effect restores history (keep pack, skip classify/transcript). */
  const historyRestoreRef = useRef(false);

  const resetPackState = useCallback(() => {
    setTranscript("");
    setTranscriptHint(null);
    setPackText(null);
    setPackError(null);
    setPackMeta(null);
    setActiveHistoryId(null);
    abortTranscriptRef.current?.abort();
    abortPackRef.current?.abort();
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
        body.packs.map((pack) => ({
          ...pack,
          videoUrl: pack.videoUrl || youtubeWatchUrl(pack.videoId),
        })),
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
      return;
    }
    resetPackState();
    const searchQuery = looksLikeYouTubeUrl(query) ? "" : query;
    void loadDetailsAndClassify(selected, searchQuery);
    void tryFetchTranscript(selected.videoId);
    // Only re-run when the selected video changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: classify against current query at selection time
  }, [selected?.videoId]);

  const selectVideo = (video: YouTubeVideo) => {
    historyRestoreRef.current = false;
    setPlaybackSec(0);
    setSelected(video);
    setPlaying(false);
    setActiveIndex(-1);
  };

  const openHistoryPack = (item: HistoryPack) => {
    const sameVideo = selected?.videoId === item.videoId;
    // Only skip classify/transcript when the selection effect will run for a new videoId.
    historyRestoreRef.current = !sameVideo;
    abortClassifyRef.current?.abort();
    abortTranscriptRef.current?.abort();
    abortPackRef.current?.abort();
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
    setActiveHistoryId(item.id);
    setPlaybackSec(0);
    setSelected({
      videoId: item.videoId,
      title: item.videoTitle,
      ...(item.channelTitle ? { channelTitle: item.channelTitle } : {}),
      thumbnailUrl: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
    });
    setPlaying(true);
    setActiveIndex(-1);
    if (!savedTranscript) {
      void tryFetchTranscript(item.videoId);
    }
  };

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
          language: "en",
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
      setActiveHistoryId(null);
      setPackBusy(false);
      if (body.saved) setOauthHasSub(true);
      if (oauthConnected) void loadHistory();
      if (oauthConnected && body.saved === false) {
        setHistoryError(
          "Pack generated but not saved to history. Sign out and sign in again, then regenerate.",
        );
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setPackBusy(false);
      setPackError(e instanceof Error ? e.message : "Could not generate learning pack");
    }
  };

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

  const showResultsPanel =
    serverConfigured &&
    (searchBusy || searchError || videos.length > 0 || query.trim().length >= 2);

  const duration = formatYouTubeDuration(selected?.duration);
  const flashcardsCsv = packText ? flashcardsToCsv(packText) : null;
  const canGenerate = transcript.trim().length >= 80 && !packBusy && perplexityConfigured;
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

  return (
    <div
      className={`flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden ${SITE_CHROME_OFFSET_CLASS}`}
    >
      <aside className="relative z-10 flex w-full shrink-0 flex-col border-b border-border bg-background lg:h-full lg:w-[380px] lg:overflow-hidden lg:border-r lg:border-b-0">
        <header className="flex shrink-0 flex-col gap-4 px-4 pt-6 pb-4 sm:px-5">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
              <Video className="size-3.5" aria-hidden />
              YouTube
            </p>
            <h1 className="mt-1 text-[28px] leading-8 font-[550] tracking-tight text-balance">
              Search or paste a link
            </h1>
            <p className="mt-1.5 text-[14px] leading-5 text-muted-foreground">
              Find a video, classify with Jev, then generate a study-ready learning pack.
            </p>
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
            <label htmlFor="youtube-search" className="sr-only">
              Search query or YouTube URL
            </label>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={inputRef}
              id="youtube-search"
              type="search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              disabled={!serverConfigured}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Topic or youtube.com / youtu.be link"
              role="combobox"
              aria-expanded={videos.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
              }
              className="h-11 w-full cursor-text rounded-md border border-border bg-background pe-10 ps-10 text-[15px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {(query || selected) && (
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear search"
                className="absolute end-2 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {youtubeOAuthClientConfigured && (
            <div className="flex flex-wrap items-center gap-2">
              {oauthConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[12px] text-ink-2">
                    {oauthEmail ?? "Signed in"}
                  </span>
                  <button
                    type="button"
                    disabled={oauthBusy}
                    onClick={() => void signOutYouTube()}
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
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 sm:px-5">
          {showResultsPanel && (
            <div className="flex shrink-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                  Results
                </h2>
                {videos.length > 0 && (
                  <p className="text-[12px] text-muted-foreground" role="status" aria-atomic="true">
                    {searchBusy ? "Refreshing…" : `${videos.length} video${videos.length === 1 ? "" : "s"}`}
                  </p>
                )}
              </div>

              <ul
                id={listboxId}
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
                {!searchBusy && !searchError && videos.length === 0 && query.trim().length >= 2 && (
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
                      id={`${listboxId}-option-${i}`}
                      role="option"
                      aria-selected={isSelected || active}
                      className={`flex items-start gap-0.5 pe-1 transition-colors duration-150 ${
                        isSelected || active ? "bg-muted/70" : "hover:bg-muted/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectVideo(video)}
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
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h2 className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                <History className="size-3.5" aria-hidden />
                History
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
              )}              {!historyBusy && historyPacks.length > 0 && (
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
                  {historyPacks.map((item) => {
                    const selectedHist = activeHistoryId === item.id;
                    const watchUrl = item.videoUrl || youtubeWatchUrl(item.videoId);
                    return (
                      <li key={item.id}>
                        <div
                          className={`flex flex-col gap-1 px-3 py-2.5 transition-colors duration-150 ${
                            selectedHist ? "bg-muted/70" : "hover:bg-muted/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openHistoryPack(item)}
                            className="flex w-full cursor-pointer flex-col gap-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                          >
                            <span className="line-clamp-1 text-[13px] font-medium text-foreground">
                              {item.videoTitle}
                            </span>
                            <span className="line-clamp-1 text-[12px] text-muted-foreground">
                              {item.channelTitle ? `${item.channelTitle} · ` : ""}
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </button>
                          <a
                            href={watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full cursor-pointer items-center gap-1 truncate text-[12px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{watchUrl}</span>
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

      <section
        className="relative z-0 isolate flex min-h-[45vh] flex-1 flex-col lg:h-full lg:min-h-0"
        aria-label="Video and learning pack"
      >
        {!selected && !packText && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 px-6 py-16 text-center">
            <Video className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-[15px] font-medium text-foreground">Pick a video</p>
            <p className="max-w-sm text-[13px] leading-5 text-muted-foreground">
              Search on the left, then open a result to play, classify, and build a learning pack.
            </p>
          </div>
        )}

        {(selected || packText) && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {selected && (
              <div className="shrink-0 border-b border-border bg-background">
                <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
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
                        ? `${packConcepts.length} timed concept${packConcepts.length === 1 ? "" : "s"} — overlay on play`
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
                          <span className="truncate">{selectedWatchUrl}</span>
                        </a>
                      )}
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
                </div>
              </div>
            )}

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
              {selected && (
                <div
                  className="rounded-md border border-border bg-card px-3 py-3 shadow-xs"
                  aria-live="polite"
                  aria-busy={classifyBusy}
                >
                  <p className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                    Jev classification
                  </p>
                  {classifyBusy && !classify && (
                    <p className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                      Classifying…
                    </p>
                  )}
                  {classifyError && !classify && (
                    <p className="text-[14px] text-destructive" role="alert">
                      {classifyError}
                    </p>
                  )}
                  {classify && (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 items-center rounded-full bg-secondary px-2.5 text-[13px] font-medium text-ink-2">
                          {topicLabel(classify.topic)}
                        </span>
                        <span
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium ${
                            classify.flagged
                              ? "bg-destructive/15 text-destructive"
                              : "bg-secondary text-ink-2"
                          }`}
                        >
                          {classify.flagged ? (
                            <Flag className="size-3.5" aria-hidden />
                          ) : (
                            <ShieldCheck className="size-3.5" aria-hidden />
                          )}
                          {classify.flagged ? "Flag" : "OK"}
                        </span>
                      </div>
                      <p className="text-[14px] leading-5 text-ink-2">{classify.line}</p>
                      <p className="text-[12px] text-muted-foreground">
                        Source: {classify.source}
                        {classify.model ? ` · ${classify.model}` : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(selected || packText) && (
                <div
                  className="rounded-md border border-border bg-card px-3 py-3 shadow-xs"
                  aria-busy={packBusy || transcriptBusy}
                >
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                    <BookOpen className="size-3.5" aria-hidden />
                    Learning pack
                  </p>

                  {selected && (
                    <>
                      <p className="mb-3 text-[13px] leading-5 text-ink-2">
                        Study materials from the spoken content. Paste captions if auto-fetch fails
                        (video → ⋯ → Show transcript).
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
                        onChange={(e) => setTranscript(e.target.value)}
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
                          onClick={() => void generateLearningPack()}
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
                          onClick={() => void tryFetchTranscript(selected.videoId)}
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
                    </>
                  )}

                  {packText && (
                    <div className={selected ? "mt-4 border-t border-border pt-4" : undefined}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadText(
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
                              downloadText(
                                `${packDownloadId}-flashcards.csv`,
                                flashcardsCsv,
                                "text/csv;charset=utf-8",
                              )
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
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
