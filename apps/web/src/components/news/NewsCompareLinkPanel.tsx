"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GitCompareArrows,
  Link2,
  LoaderCircle,
  Network,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { GraphPayload } from "@/lib/neo4j/types";
import type { OverlapEntity, UserKnowledgeLinkType } from "@/lib/news/personalKnowledgeMerge";
import { ArcGraphCanvas } from "@/components/youtube/knowledge-graph/arc-graph-canvas";

type ArticleSummary = {
  id: string;
  storyId: string;
  title: string;
  canonicalUrl: string;
  nodeCount: number;
  linkCount: number;
  updatedAt: number;
};

type LinkRow = {
  id: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  type: UserKnowledgeLinkType;
  note: string | null;
  createdAt: number;
};

type PersonalGraphResponse = {
  success: boolean;
  signedIn?: boolean;
  articles?: ArticleSummary[];
  links?: LinkRow[];
  graph?: GraphPayload | null;
  overlap?: OverlapEntity[] | null;
  error?: string;
};

type LinkSuggestResponse = {
  success: boolean;
  linkType?: UserKnowledgeLinkType;
  confidence?: number;
  line?: string;
  source?: "jev" | "mock";
  error?: string;
};

const LINK_TYPES: UserKnowledgeLinkType[] = [
  "RELATED_TO",
  "SUPPORTS",
  "CONTRASTS_WITH",
];

type Props = {
  signedIn: boolean;
  onSignIn: () => void;
  refreshKey?: number;
};

function displayNameForKey(
  key: string,
  overlap: OverlapEntity[] | null,
  graph: GraphPayload | null,
): string {
  const fromOverlap = overlap?.find((o) => o.canonicalKey === key);
  if (fromOverlap?.name) return fromOverlap.name;
  for (const n of graph?.nodes ?? []) {
    const k = n.properties.canonicalKey;
    if (k === key) {
      for (const prop of ["name", "title", "term", "text"] as const) {
        const v = n.properties[prop];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      if (n.label.trim()) return n.label.trim();
    }
  }
  return key;
}

export function NewsCompareLinkPanel({ signedIn, onSignIn, refreshKey = 0 }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [overlap, setOverlap] = useState<OverlapEntity[] | null>(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [linkType, setLinkType] = useState<UserKnowledgeLinkType>("RELATED_TO");
  const [linkNote, setLinkNote] = useState("");
  const [selectedOverlap, setSelectedOverlap] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestLine, setSuggestLine] = useState<string | null>(null);
  const [suggestSource, setSuggestSource] = useState<"jev" | "mock" | null>(null);
  const [userPickedType, setUserPickedType] = useState(false);
  const suggestAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setArticles([]);
      setLinks([]);
      setGraph(null);
      setOverlap(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (compareA && compareB) {
        params.set("compareA", compareA);
        params.set("compareB", compareB);
      }
      const qs = params.toString();
      const res = await fetch(
        `/api/news/personal-graph${qs ? `?${qs}` : ""}`,
      );
      const body = (await res.json()) as PersonalGraphResponse;
      if (!body.success) {
        setError(body.error ?? "Could not load personal graph");
        setBusy(false);
        return;
      }
      setArticles(body.articles ?? []);
      setLinks(body.links ?? []);
      setGraph(body.graph ?? null);
      setOverlap(body.overlap ?? null);
      setBusy(false);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not load personal graph");
    }
  }, [signedIn, compareA, compareB]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const entityKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const n of graph?.nodes ?? []) {
      const k = n.properties.canonicalKey;
      if (typeof k === "string" && k && !k.startsWith("article:") && !k.startsWith("source:")) {
        keys.add(k);
      }
    }
    return [...keys].sort();
  }, [graph]);

  const articleTitle = useCallback(
    (storyId: string) => articles.find((a) => a.storyId === storyId)?.title ?? "",
    [articles],
  );

  useEffect(() => {
    if (!selectedOverlap || !targetKey || selectedOverlap === targetKey) {
      setSuggestLine(null);
      setSuggestSource(null);
      suggestAbortRef.current?.abort();
      return;
    }

    suggestAbortRef.current?.abort();
    const ac = new AbortController();
    suggestAbortRef.current = ac;
    setSuggestBusy(true);
    setSuggestLine(null);

    const sourceName = displayNameForKey(selectedOverlap, overlap, graph);
    const targetName = displayNameForKey(targetKey, overlap, graph);
    const sourceContext = [articleTitle(compareA), articleTitle(compareB)]
      .filter(Boolean)
      .join("\n");

    void (async () => {
      try {
        const res = await fetch("/api/news/link-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            sourceName,
            targetName,
            ...(sourceContext ? { sourceContext } : {}),
          }),
        });
        const body = (await res.json()) as LinkSuggestResponse;
        if (ac.signal.aborted) return;
        if (!body.success || !body.linkType) {
          setSuggestBusy(false);
          return;
        }
        if (!userPickedType) {
          setLinkType(body.linkType);
        }
        setSuggestLine(body.line ?? null);
        setSuggestSource(body.source ?? null);
        setSuggestBusy(false);
      } catch (e) {
        if (ac.signal.aborted) return;
        setSuggestBusy(false);
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();

    return () => {
      ac.abort();
    };
  }, [
    selectedOverlap,
    targetKey,
    overlap,
    graph,
    compareA,
    compareB,
    articleTitle,
    userPickedType,
  ]);

  const createLink = async () => {
    const source = selectedOverlap ?? "";
    const target = targetKey.trim();
    if (!source || !target || source === target) return;
    setLinkBusy(true);
    try {
      const res = await fetch("/api/news/knowledge-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNodeKey: source,
          targetNodeKey: target,
          type: linkType,
          ...(linkNote.trim() ? { note: linkNote.trim() } : {}),
        }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!body.success) {
        setError(body.error ?? "Could not create link");
      } else {
        setLinkNote("");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link");
    } finally {
      setLinkBusy(false);
    }
  };

  const removeLink = async (id: string) => {
    setLinkBusy(true);
    try {
      const res = await fetch("/api/news/knowledge-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (!body.success) {
        setError(body.error ?? "Could not remove link");
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove link");
    } finally {
      setLinkBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-medium">
          <GitCompareArrows className="size-4" aria-hidden />
          Compare &amp; link
        </h2>
        <p className="text-[14px] leading-5 text-muted-foreground">
          Sign in with Google to save article graphs and link overlapping concepts across
          stories.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border bg-background px-3 text-[13px] font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-medium">
          <Network className="size-4" aria-hidden />
          Personal knowledge
        </h2>
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">
            {articles.length} articles · {links.length} links
          </span>
        )}
      </div>

      {error ? (
        <p className="text-[13px] text-[var(--caution)]" role="alert">
          {error}
        </p>
      ) : null}

      {articles.length === 0 && !busy ? (
        <p className="text-[14px] leading-5 text-muted-foreground">
          Open a story, generate a deep dive, then build and save a graph. Saved articles
          appear here for compare &amp; link.
        </p>
      ) : null}

      {articles.length >= 2 ? (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-3" aria-label="Compare articles">
          <h3 className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <GitCompareArrows className="size-3.5" aria-hidden />
            Compare
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
              Article A
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="h-9 cursor-pointer rounded-md border bg-background px-2 text-[13px] text-foreground"
              >
                <option value="">Select…</option>
                {articles.map((a) => (
                  <option key={a.storyId} value={a.storyId} disabled={a.storyId === compareB}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
              Article B
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="h-9 cursor-pointer rounded-md border bg-background px-2 text-[13px] text-foreground"
              >
                <option value="">Select…</option>
                {articles.map((a) => (
                  <option key={a.storyId} value={a.storyId} disabled={a.storyId === compareA}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {overlap ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] text-muted-foreground">
                {overlap.length === 0
                  ? "No shared entities between these articles."
                  : `${overlap.length} shared entit${overlap.length === 1 ? "y" : "ies"}:`}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {overlap.map((o) => (
                  <li key={o.canonicalKey}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOverlap(o.canonicalKey);
                        setUserPickedType(false);
                      }}
                      aria-pressed={selectedOverlap === o.canonicalKey}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        selectedOverlap === o.canonicalKey
                          ? "border-foreground bg-foreground text-background"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {o.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedOverlap ? (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-3" aria-label="Create link">
          <h3 className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <Link2 className="size-3.5" aria-hidden />
            Link from {selectedOverlap}
          </h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={linkType}
              onChange={(e) => {
                setUserPickedType(true);
                setLinkType(e.target.value as UserKnowledgeLinkType);
              }}
              className="h-9 cursor-pointer rounded-md border bg-background px-2 text-[13px]"
              aria-label="Link type"
            >
              {LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={targetKey}
              onChange={(e) => {
                setTargetKey(e.target.value);
                setUserPickedType(false);
              }}
              className="h-9 min-w-[10rem] flex-1 cursor-pointer rounded-md border bg-background px-2 text-[13px]"
              aria-label="Link target entity"
            >
              <option value="">Target entity…</option>
              {entityKeys
                .filter((k) => k !== selectedOverlap)
                .map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
            </select>
          </div>
          {targetKey ? (
            <p
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
              aria-live="polite"
            >
              {suggestBusy ? (
                <>
                  <LoaderCircle className="size-3 animate-spin" aria-hidden />
                  Suggesting link type…
                </>
              ) : suggestLine ? (
                <>
                  <Sparkles className="size-3" aria-hidden />
                  Jev suggests: {suggestLine}
                  {suggestSource === "mock" ? " (offline)" : null}
                </>
              ) : null}
            </p>
          ) : null}
          <input
            type="text"
            value={linkNote}
            onChange={(e) => setLinkNote(e.target.value)}
            placeholder="Optional note"
            maxLength={500}
            className="h-9 rounded-md border bg-background px-2 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void createLink()}
            disabled={linkBusy || !targetKey}
            className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-[13px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linkBusy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Link2 className="size-3.5" aria-hidden />
            )}
            Create link
          </button>
        </section>
      ) : null}

      {links.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Your links">
          <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Your links
          </h3>
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-card px-3 py-2 text-[13px]"
              >
                <span>
                  <span className="font-medium">{l.sourceNodeKey}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    —{l.type.replace(/_/g, " ").toLowerCase()}→{" "}
                  </span>
                  <span className="font-medium">{l.targetNodeKey}</span>
                  {l.note ? (
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {l.note}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => void removeLink(l.id)}
                  disabled={linkBusy}
                  className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Remove link"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {graph && graph.nodes.length > 0 ? (
        <section className="flex min-h-[280px] flex-col gap-2" aria-label="Merged personal graph">
          <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Merged graph
          </h3>
          <div className="min-h-[260px] flex-1 overflow-hidden rounded-lg border bg-background">
            <ArcGraphCanvas
              graph={graph}
              layout="sidebar"
              footerHint={`${graph.nodes.length} nodes · ${graph.links.length} relationships`}
            />
          </div>
          <p className="text-[12px] text-muted-foreground">
            {graph.nodes.length} nodes · {graph.links.length} relationships
          </p>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section className="flex flex-col gap-1.5" aria-label="Saved articles">
          <h3 className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Saved article graphs
          </h3>
          <ul className="flex flex-col gap-1">
            {articles.map((a) => (
              <li key={a.id} className="rounded-md border bg-card px-3 py-2 text-[13px]">
                <span className="font-medium text-ink-2">{a.title}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {a.nodeCount} nodes · {a.linkCount} links
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
