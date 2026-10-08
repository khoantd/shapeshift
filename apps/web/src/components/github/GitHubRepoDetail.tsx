"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Download,
  ExternalLink,
  Loader2,
  Network,
  Sparkles,
  Star,
  Video,
  X,
} from "lucide-react";
import { MarkdownBody } from "@shapeshift/react";
import { GITHUB_TOPIC_CATALOG } from "@/lib/github/topics";
import { gitDiagramUrls } from "@/lib/github/repoUrl";
import { videoPlaybackProxyPath } from "@/lib/github/repoVideoParse";
import type { GithubRepoCard } from "@/lib/github/types";
import type { AppLocale } from "@/i18n/routing";
import { MermaidDiagram } from "./MermaidDiagram";
import { RelatedNewsSection } from "@/components/shared/RelatedNewsSection";
import { RelatedVideosSection } from "./RelatedVideosSection";

function videoClientUrl(
  fullName: string,
  language: "en" | "vi",
  contentHash: string,
): string {
  return videoPlaybackProxyPath({ fullName, language, contentHash });
}

type DetailTab = "summary" | "diagram" | "explainer" | "video" | "readme";

type ReadmeState =
  | { status: "idle" | "loading" }
  | { status: "ready"; markdown: string }
  | { status: "missing" }
  | { status: "error"; message: string };

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string; unavailable?: boolean };

type DiagramState =
  | { status: "idle" }
  | { status: "loading"; step: number }
  | { status: "ready"; mermaid: string; notes: string | null }
  | { status: "error"; message: string; unavailable?: boolean };

type ExplainerChapter = { title: string; body: string };

type ExplainerState =
  | { status: "idle" }
  | { status: "loading"; step: number }
  | { status: "ready"; chapters: ExplainerChapter[] }
  | { status: "error"; message: string; unavailable?: boolean };

type VideoState =
  | { status: "idle" }
  | { status: "loading"; step: number; resume?: boolean }
  | {
      status: "ready";
      url: string;
      contentHash: string;
      chapters: ExplainerChapter[];
    }
  | {
      status: "error";
      message: string;
      unavailable?: boolean;
      /** Prior attempt may have uploaded chapter audio — Resume reuses it */
      resumable?: boolean;
    };

const summaryCache = new Map<string, string>();
const diagramCache = new Map<
  string,
  { mermaid: string; notes: string | null }
>();
const explainerCache = new Map<string, ExplainerChapter[]>();
const videoCache = new Map<
  string,
  { url: string; contentHash: string; chapters: ExplainerChapter[] }
>();

const DIAGRAM_STEPS = [
  "diagramStepTree",
  "diagramStepUnderstand",
  "diagramStepDraw",
] as const;

const EXPLAINER_STEPS = [
  "explainerStepRead",
  "explainerStepStructure",
  "explainerStepScript",
] as const;

const VIDEO_STEPS = [
  "videoStepScript",
  "videoStepVoice",
  "videoStepRender",
  "videoStepUpload",
] as const;

export function GitHubRepoDetail({
  repo,
  onClose,
}: {
  repo: GithubRepoCard;
  onClose: () => void;
}) {
  const t = useTranslations("GitHub");
  const locale = useLocale() as AppLocale;
  const matched = GITHUB_TOPIC_CATALOG.filter((topic) =>
    repo.matchedTopicIds.includes(topic.id),
  );
  const gitDiagram = gitDiagramUrls(repo.fullName);

  const [tab, setTab] = useState<DetailTab>("summary");
  const [readme, setReadme] = useState<ReadmeState>({ status: "loading" });
  const [summary, setSummary] = useState<SummaryState>(() => {
    const cached = summaryCache.get(repo.fullName);
    return cached
      ? { status: "ready", text: cached }
      : { status: "idle" };
  });
  const [diagram, setDiagram] = useState<DiagramState>(() => {
    const cached = diagramCache.get(repo.fullName);
    return cached
      ? { status: "ready", mermaid: cached.mermaid, notes: cached.notes }
      : { status: "idle" };
  });
  const [explainer, setExplainer] = useState<ExplainerState>(() => {
    const cached = explainerCache.get(repo.fullName);
    return cached
      ? { status: "ready", chapters: cached }
      : { status: "idle" };
  });
  const [explainerChapter, setExplainerChapter] = useState(0);
  const [video, setVideo] = useState<VideoState>(() => {
    const cached = videoCache.get(repo.fullName);
    return cached
      ? {
          status: "ready",
          url: videoClientUrl(
            repo.fullName,
            locale === "vi" ? "vi" : "en",
            cached.contentHash,
          ),
          contentHash: cached.contentHash,
          chapters: cached.chapters,
        }
      : { status: "idle" };
  });
  const [treeOutline, setTreeOutline] = useState<string | null>(null);

  const readmeMarkdownRef = useRef<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const diagramAbortRef = useRef<AbortController | null>(null);
  const explainerAbortRef = useRef<AbortController | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cachedSummary = summaryCache.get(repo.fullName);
    setSummary(
      cachedSummary
        ? { status: "ready", text: cachedSummary }
        : { status: "idle" },
    );
    const cachedDiagram = diagramCache.get(repo.fullName);
    setDiagram(
      cachedDiagram
        ? {
            status: "ready",
            mermaid: cachedDiagram.mermaid,
            notes: cachedDiagram.notes,
          }
        : { status: "idle" },
    );
    const cachedExplainer = explainerCache.get(repo.fullName);
    setExplainer(
      cachedExplainer
        ? { status: "ready", chapters: cachedExplainer }
        : { status: "idle" },
    );
    const cachedVideo = videoCache.get(repo.fullName);
    setVideo(
      cachedVideo
        ? {
            status: "ready",
            url: videoClientUrl(
              repo.fullName,
              locale === "vi" ? "vi" : "en",
              cachedVideo.contentHash,
            ),
            contentHash: cachedVideo.contentHash,
            chapters: cachedVideo.chapters,
          }
        : { status: "idle" },
    );
    setExplainerChapter(0);
    setTab("summary");
    setReadme({ status: "loading" });
    setTreeOutline(null);
    readmeMarkdownRef.current = null;
    diagramAbortRef.current?.abort();
    explainerAbortRef.current?.abort();
    videoAbortRef.current?.abort();

    const ac = new AbortController();
    void (async () => {
      try {
        const [readmeRes, treeRes] = await Promise.all([
          fetch(
            `/api/github/readme?repo=${encodeURIComponent(repo.fullName)}`,
            { signal: ac.signal },
          ),
          fetch(
            `/api/github/tree?repo=${encodeURIComponent(repo.fullName)}`,
            { signal: ac.signal },
          ),
        ]);

        const readmeBody = (await readmeRes.json()) as {
          success?: boolean;
          markdown?: string;
          error?: string;
          reason?: string;
        };
        if (ac.signal.aborted) return;
        if (readmeRes.status === 404 || readmeBody.reason === "missing") {
          setReadme({ status: "missing" });
        } else if (
          !readmeRes.ok ||
          !readmeBody.success ||
          typeof readmeBody.markdown !== "string"
        ) {
          setReadme({
            status: "error",
            message: readmeBody.error || tRef.current("errorReadme"),
          });
        } else {
          readmeMarkdownRef.current = readmeBody.markdown;
          setReadme({ status: "ready", markdown: readmeBody.markdown });
        }

        const treeBody = (await treeRes.json()) as {
          success?: boolean;
          outline?: string;
        };
        if (
          !ac.signal.aborted &&
          treeRes.ok &&
          treeBody.success &&
          typeof treeBody.outline === "string"
        ) {
          setTreeOutline(treeBody.outline);
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setReadme({
          status: "error",
          message:
            e instanceof Error ? e.message : tRef.current("errorReadme"),
        });
      }
    })();

    return () => {
      ac.abort();
      diagramAbortRef.current?.abort();
      explainerAbortRef.current?.abort();
      videoAbortRef.current?.abort();
    };
  }, [repo.fullName]);

  useEffect(() => {
    if (diagram.status !== "loading") return;
    const id = window.setInterval(() => {
      setDiagram((prev) => {
        if (prev.status !== "loading") return prev;
        return {
          status: "loading",
          step: Math.min(prev.step + 1, DIAGRAM_STEPS.length - 1),
        };
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [diagram.status]);

  useEffect(() => {
    if (explainer.status !== "loading") return;
    const id = window.setInterval(() => {
      setExplainer((prev) => {
        if (prev.status !== "loading") return prev;
        return {
          status: "loading",
          step: Math.min(prev.step + 1, EXPLAINER_STEPS.length - 1),
        };
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [explainer.status]);

  useEffect(() => {
    if (video.status !== "loading") return;
    const id = window.setInterval(() => {
      setVideo((prev) => {
        if (prev.status !== "loading") return prev;
        return {
          status: "loading",
          step: Math.min(prev.step + 1, VIDEO_STEPS.length - 1),
        };
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [video.status]);

  async function onSummarize(force = false) {
    setSummary({ status: "loading" });
    try {
      const res = await fetch("/api/github/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          description: repo.description,
          readme: readmeMarkdownRef.current ?? undefined,
          language: locale === "vi" ? "vi" : "en",
          ...(force ? { force: true } : {}),
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        text?: string;
        error?: string;
      };
      if (!res.ok || !body.success || typeof body.text !== "string") {
        setSummary({
          status: "error",
          message:
            body.error ||
            (res.status === 503 ? t("summaryUnavailable") : t("errorSummary")),
          unavailable: res.status === 503,
        });
        return;
      }
      summaryCache.set(repo.fullName, body.text);
      setSummary({ status: "ready", text: body.text });
    } catch (e) {
      setSummary({
        status: "error",
        message: e instanceof Error ? e.message : t("errorSummary"),
      });
    }
  }

  async function onGenerateDiagram(force = false) {
    diagramAbortRef.current?.abort();
    const ac = new AbortController();
    diagramAbortRef.current = ac;
    setDiagram({ status: "loading", step: 0 });
    try {
      const res = await fetch("/api/github/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          description: repo.description,
          readme: readmeMarkdownRef.current ?? undefined,
          treeOutline: treeOutline ?? undefined,
          language: locale === "vi" ? "vi" : "en",
          ...(force ? { force: true } : {}),
        }),
        signal: ac.signal,
      });
      const body = (await res.json()) as {
        success?: boolean;
        mermaid?: string;
        notes?: string | null;
        error?: string;
      };
      if (ac.signal.aborted) return;
      if (!res.ok || !body.success || typeof body.mermaid !== "string") {
        setDiagram({
          status: "error",
          message:
            body.error ||
            (res.status === 503
              ? t("diagramUnavailable")
              : t("errorDiagram")),
          unavailable: res.status === 503,
        });
        return;
      }
      const notes =
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : null;
      diagramCache.set(repo.fullName, { mermaid: body.mermaid, notes });
      setDiagram({ status: "ready", mermaid: body.mermaid, notes });
    } catch (e) {
      if (ac.signal.aborted) return;
      setDiagram({
        status: "error",
        message: e instanceof Error ? e.message : t("errorDiagram"),
      });
    }
  }

  async function onGenerateExplainer(force = false) {
    explainerAbortRef.current?.abort();
    const ac = new AbortController();
    explainerAbortRef.current = ac;
    setExplainer({ status: "loading", step: 0 });
    setExplainerChapter(0);
    try {
      const res = await fetch("/api/github/explainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          description: repo.description,
          readme: readmeMarkdownRef.current ?? undefined,
          treeOutline: treeOutline ?? undefined,
          language: locale === "vi" ? "vi" : "en",
          ...(force ? { force: true } : {}),
        }),
        signal: ac.signal,
      });
      const body = (await res.json()) as {
        success?: boolean;
        chapters?: ExplainerChapter[];
        error?: string;
      };
      if (ac.signal.aborted) return;
      if (
        !res.ok ||
        !body.success ||
        !Array.isArray(body.chapters) ||
        body.chapters.length < 2
      ) {
        setExplainer({
          status: "error",
          message:
            body.error ||
            (res.status === 503
              ? t("explainerUnavailable")
              : t("errorExplainer")),
          unavailable: res.status === 503,
        });
        return;
      }
      explainerCache.set(repo.fullName, body.chapters);
      setExplainer({ status: "ready", chapters: body.chapters });
    } catch (e) {
      if (ac.signal.aborted) return;
      setExplainer({
        status: "error",
        message: e instanceof Error ? e.message : t("errorExplainer"),
      });
    }
  }

  async function onGenerateVideo(force = false, resume = false) {
    videoAbortRef.current?.abort();
    const ac = new AbortController();
    videoAbortRef.current = ac;
    setVideo({
      status: "loading",
      step: resume ? 1 : 0,
      resume: resume && !force,
    });
    try {
      const res = await fetch("/api/github/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.fullName,
          description: repo.description,
          readme: readmeMarkdownRef.current ?? undefined,
          treeOutline: treeOutline ?? undefined,
          language: locale === "vi" ? "vi" : "en",
          ...(force ? { force: true } : {}),
        }),
        signal: ac.signal,
      });
      const body = (await res.json()) as {
        success?: boolean;
        url?: string;
        contentHash?: string;
        chapters?: ExplainerChapter[];
        resumedAudioCount?: number;
        error?: string;
      };
      if (ac.signal.aborted) return;
      if (
        !res.ok ||
        !body.success ||
        typeof body.url !== "string" ||
        typeof body.contentHash !== "string"
      ) {
        setVideo({
          status: "error",
          message:
            body.error ||
            (res.status === 503 ? t("videoUnavailable") : t("errorVideo")),
          unavailable: res.status === 503,
          // Config errors are not resumable; other failures may have partial audio
          resumable: res.status !== 503 && res.status !== 400,
        });
        return;
      }
      const chapters = Array.isArray(body.chapters) ? body.chapters : [];
      const playbackUrl = videoClientUrl(
        repo.fullName,
        locale === "vi" ? "vi" : "en",
        body.contentHash,
      );
      videoCache.set(repo.fullName, {
        url: playbackUrl,
        contentHash: body.contentHash,
        chapters,
      });
      if (chapters.length >= 2) {
        explainerCache.set(repo.fullName, chapters);
        setExplainer({ status: "ready", chapters });
      }
      setVideo({
        status: "ready",
        url: playbackUrl,
        contentHash: body.contentHash,
        chapters,
      });
    } catch (e) {
      if (ac.signal.aborted) return;
      setVideo({
        status: "error",
        message: e instanceof Error ? e.message : t("errorVideo"),
        resumable: true,
      });
    }
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "summary", label: t("summary") },
    { id: "diagram", label: t("diagram") },
    { id: "explainer", label: t("explainer") },
    { id: "video", label: t("video") },
    { id: "readme", label: t("readme") },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("selectedRepo")}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {repo.fullName}
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {repo.description ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5" aria-hidden />
            {repo.stars.toLocaleString()} {t("stars")}
          </span>
          <span>
            {repo.forks.toLocaleString()} {t("forks")}
          </span>
          {repo.language ? <span>{repo.language}</span> : null}
        </div>

        {matched.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {matched.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex h-7 items-center rounded-md border border-border bg-muted/40 px-2 text-[12px] text-foreground"
              >
                {topic.label}
              </span>
            ))}
          </div>
        ) : null}

        {repo.topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {repo.topics.slice(0, 12).map((topic) => (
              <span
                key={topic}
                className="inline-flex h-6 items-center rounded-md bg-muted/50 px-2 text-[11px] text-muted-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("openOnGithub")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a
            href={gitDiagram.diagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("openOnGitDiagram")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a
            href={gitDiagram.video}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("watchGitDiagramVideo")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>

        <div
          role="tablist"
          aria-label={t("detailTabs")}
          className="flex flex-wrap gap-1 border-b border-border pb-px"
        >
          {tabs.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`github-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "summary" ? (
          <section
            role="tabpanel"
            aria-labelledby="github-tab-summary"
            className="flex flex-col gap-3 pb-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("summary")}
              </h2>
              {summary.status === "ready" ? (
                <button
                  type="button"
                  onClick={() => void onSummarize(true)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("regenerateSummary")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSummarize(false)}
                  disabled={
                    summary.status === "loading" ||
                    readme.status === "loading" ||
                    readme.status === "missing"
                  }
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {summary.status === "loading" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {summary.status === "loading"
                    ? t("summarizing")
                    : t("summarize")}
                </button>
              )}
            </div>
            {summary.status === "idle" ? (
              <p className="text-[13px] text-muted-foreground">
                {t("summaryHint")}
              </p>
            ) : null}
            {summary.status === "loading" ? (
              <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t("summarizing")}
              </p>
            ) : null}
            {summary.status === "error" ? (
              <p className="text-[13px] text-destructive" role="alert">
                {summary.message}
              </p>
            ) : null}
            {summary.status === "ready" ? (
              <MarkdownBody className="text-foreground">
                {summary.text}
              </MarkdownBody>
            ) : null}
          </section>
        ) : null}

        {tab === "diagram" ? (
          <section
            role="tabpanel"
            aria-labelledby="github-tab-diagram"
            className="flex flex-col gap-3 pb-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("diagram")}
              </h2>
              {diagram.status === "ready" ? (
                <button
                  type="button"
                  onClick={() => void onGenerateDiagram(true)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("regenerateDiagram")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onGenerateDiagram(false)}
                  disabled={diagram.status === "loading"}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {diagram.status === "loading" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Network className="size-3.5" aria-hidden />
                  )}
                  {diagram.status === "loading"
                    ? t("generatingDiagram")
                    : t("generateDiagram")}
                </button>
              )}
            </div>
            {diagram.status === "idle" ? (
              <p className="text-[13px] text-muted-foreground">
                {t("diagramHint")}
              </p>
            ) : null}
            {diagram.status === "loading" ? (
              <p
                className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t(DIAGRAM_STEPS[diagram.step] ?? "generatingDiagram")}
              </p>
            ) : null}
            {diagram.status === "error" ? (
              <p className="text-[13px] text-destructive" role="alert">
                {diagram.message}
              </p>
            ) : null}
            {diagram.status === "ready" ? (
              <>
                <MermaidDiagram source={diagram.mermaid} />
                {diagram.notes ? (
                  <MarkdownBody className="text-foreground">
                    {diagram.notes}
                  </MarkdownBody>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {tab === "explainer" ? (
          <section
            role="tabpanel"
            aria-labelledby="github-tab-explainer"
            className="flex flex-col gap-3 pb-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("explainer")}
              </h2>
              {explainer.status === "ready" ? (
                <button
                  type="button"
                  onClick={() => void onGenerateExplainer(true)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("regenerateExplainer")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onGenerateExplainer(false)}
                  disabled={explainer.status === "loading"}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {explainer.status === "loading" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {explainer.status === "loading"
                    ? t("generatingExplainer")
                    : t("generateExplainer")}
                </button>
              )}
            </div>
            {explainer.status === "idle" ? (
              <p className="text-[13px] text-muted-foreground">
                {t("explainerHint")}
              </p>
            ) : null}
            {explainer.status === "loading" ? (
              <p
                className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t(EXPLAINER_STEPS[explainer.step] ?? "generatingExplainer")}
              </p>
            ) : null}
            {explainer.status === "error" ? (
              <p className="text-[13px] text-destructive" role="alert">
                {explainer.message}
              </p>
            ) : null}
            {explainer.status === "ready" ? (
              <div className="flex flex-col gap-4">
                <div
                  className="flex flex-wrap gap-1.5"
                  role="tablist"
                  aria-label={t("explainerChapters")}
                >
                  {explainer.chapters.map((ch, i) => (
                    <button
                      key={`${ch.title}-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={explainerChapter === i}
                      onClick={() => setExplainerChapter(i)}
                      className={`inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        explainerChapter === i
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {i + 1}. {ch.title}
                    </button>
                  ))}
                </div>
                <article className="rounded-md border border-border bg-muted/20 p-4">
                  <h3 className="text-[15px] font-medium text-foreground">
                    {explainer.chapters[explainerChapter]?.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                    {explainer.chapters[explainerChapter]?.body}
                  </p>
                </article>
                <p className="text-[12px] text-muted-foreground">
                  {t("explainerVideoHint")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setTab("video");
                      if (video.status === "idle") void onGenerateVideo(false);
                    }}
                    className="cursor-pointer font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t("generateVideo")}
                  </button>
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "video" ? (
          <section
            role="tabpanel"
            aria-labelledby="github-tab-video"
            className="flex flex-col gap-3 pb-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("video")}
              </h2>
              {video.status === "ready" ? (
                <button
                  type="button"
                  onClick={() => void onGenerateVideo(true)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("regenerateVideo")}
                </button>
              ) : video.status === "error" && video.resumable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onGenerateVideo(false, true)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Video className="size-3.5" aria-hidden />
                    {t("resumeVideo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onGenerateVideo(true)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t("regenerateVideo")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onGenerateVideo(false)}
                  disabled={video.status === "loading"}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {video.status === "loading" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Video className="size-3.5" aria-hidden />
                  )}
                  {video.status === "loading"
                    ? t("generatingVideo")
                    : t("generateVideo")}
                </button>
              )}
            </div>
            {video.status === "idle" ? (
              <p className="text-[13px] text-muted-foreground">
                {t("videoHint")}
              </p>
            ) : null}
            {video.status === "loading" ? (
              <p
                className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {video.resume && video.step === 1
                  ? t("videoStepVoiceResume")
                  : t(VIDEO_STEPS[video.step] ?? "generatingVideo")}
              </p>
            ) : null}
            {video.status === "error" ? (
              <div className="flex flex-col gap-1.5" role="alert">
                <p className="text-[13px] text-destructive">{video.message}</p>
                {video.resumable ? (
                  <p className="text-[12px] text-muted-foreground">
                    {t("resumeVideoHint")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {video.status === "ready" ? (
              <div className="flex flex-col gap-3">
                <video
                  key={video.contentHash}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full rounded-md border border-border bg-black"
                  src={video.url}
                >
                  <track kind="captions" />
                </video>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={video.url}
                    download={`${repo.fullName.replace("/", "-")}-explainer.mp4`}
                    className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Download className="size-3.5" aria-hidden />
                    {t("downloadVideo")}
                  </a>
                  <a
                    href={gitDiagram.video}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t("watchGitDiagramVideo")}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "readme" ? (
          <section
            role="tabpanel"
            aria-labelledby="github-tab-readme"
            className="flex flex-col gap-3 pb-8"
          >
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("readme")}
            </h2>
            {readme.status === "loading" ? (
              <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t("loadingReadme")}
              </p>
            ) : null}
            {readme.status === "missing" ? (
              <p className="text-[13px] text-muted-foreground">{t("noReadme")}</p>
            ) : null}
            {readme.status === "error" ? (
              <p className="text-[13px] text-destructive" role="alert">
                {readme.message}
              </p>
            ) : null}
            {readme.status === "ready" ? (
              <MarkdownBody className="text-foreground">
                {readme.markdown}
              </MarkdownBody>
            ) : null}
          </section>
        ) : null}

        <div className="pb-8">
          <RelatedVideosSection repo={repo} />
          <RelatedNewsSection source="repo" repo={repo} />
        </div>
      </div>
    </div>
  );
}
