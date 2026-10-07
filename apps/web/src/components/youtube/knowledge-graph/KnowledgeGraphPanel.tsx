"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Focus,
  GitBranch,
  LoaderCircle,
  Network,
  RefreshCw,
  X,
} from "lucide-react";
import type { GraphLink, GraphNode, GraphPayload } from "@/lib/neo4j/types";
import {
  addGraphLink,
  addGraphNode,
  deleteGraphNode,
  type GraphNodeKind,
} from "@/lib/neo4j/mutateGraph";
import { renameGraphNode } from "@/lib/neo4j/renameGraphNode";
import { newlyAppearedNodeIds } from "@/lib/youtube/graphAppearHighlight";
import {
  countLabels,
  countRelTypes,
  focusByProgress,
  focusByType,
  focusNeighborhood,
  nodeStartSec,
  type NeighborhoodHops,
} from "@/lib/youtube/graphNeighborhood";
import { AddNodePopover } from "@/components/knowledge-graph/AddNodePopover";
import { InlineNodeLabel } from "@/components/knowledge-graph/InlineNodeLabel";
import { SelectedNodeRenameBar } from "@/components/knowledge-graph/SelectedNodeRenameBar";
import { ArcGraphCanvas, type GraphEditMode } from "./arc-graph-canvas";
import type { TypeFocusHandlers } from "./ClickableOverviewPane";

const HIGHLIGHT_MS = 2200;

type Props = {
  videoId: string;
  title: string;
  channelTitle?: string;
  contentType?: string;
  markdown: string;
  onSeek?: (startSec: number) => void;
  /** Current video playback position (seconds). Used when Follow video is on. */
  playbackSec?: number;
  /** When true, omit outer card chrome (parent already provides a Study tab). */
  embedded?: boolean;
  /** Tighter canvas when embedded in the Study sidebar. */
  layout?: "default" | "sidebar";
  /** Saved graph from history — skip auto-rebuild when present. */
  initialGraph?: GraphPayload | null;
  /** Convex history row id — Refresh updates the saved snapshot. */
  historyPackId?: string | null;
  /** Called when a new graph is built (so parent can update local history cache). */
  onGraphReady?: (graph: GraphPayload) => void;
};

type ApiResponse = {
  success: boolean;
  graph?: GraphPayload;
  persisted?: boolean;
  neo4jConfigured?: boolean;
  historySaved?: boolean;
  signedIn?: boolean;
  warning?: string;
  error?: string;
};

type ViewMode = "all" | "neighbors";

function labelKind(labels: string[]): string {
  if (labels.includes("YtVideo")) return "Video";
  if (labels.includes("YtConcept")) return "Concept";
  if (labels.includes("YtGlossaryTerm")) return "Term";
  if (labels.includes("YtInsight")) return "Insight";
  return labels[0] ?? "Node";
}

function nodeDisplayName(node: GraphNode): string {
  for (const key of ["title", "term", "name", "text"] as const) {
    const v = node.properties[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return node.label;
}

function linkedTitles(
  node: GraphNode,
  links: GraphLink[],
  byId: Map<string, GraphNode>,
): string[] {
  const titles: string[] = [];
  for (const l of links) {
    let otherId: string | null = null;
    if (l.source === node.id) otherId = l.target;
    else if (l.target === node.id) otherId = l.source;
    if (!otherId) continue;
    const other = byId.get(otherId);
    if (other) titles.push(nodeDisplayName(other));
  }
  return [...new Set(titles)].slice(0, 6);
}

function formatPlaybackClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function SegmentButton({
  pressed,
  onClick,
  children,
  disabled,
  ariaLabel,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={`inline-flex h-8 cursor-pointer items-center px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed
          ? "bg-foreground text-background"
          : "bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function KnowledgeGraphPanel({
  videoId,
  title,
  channelTitle,
  contentType,
  markdown,
  onSeek,
  playbackSec = 0,
  embedded = false,
  layout = "default",
  initialGraph = null,
  historyPackId = null,
  onGraphReady,
}: Props) {
  const seeded =
    initialGraph != null &&
    Array.isArray(initialGraph.nodes) &&
    initialGraph.nodes.length > 0;

  const [graph, setGraph] = useState<GraphPayload | null>(seeded ? initialGraph : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [neo4jConfigured, setNeo4jConfigured] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renameBusyId, setRenameBusyId] = useState<string | null>(null);
  const [mutateBusy, setMutateBusy] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [hops, setHops] = useState<NeighborhoodHops>(1);
  const [followPlayback, setFollowPlayback] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedRelTypes, setSelectedRelTypes] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightNodeIds, setHighlightNodeIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<GraphEditMode>("select");
  const [addPopover, setAddPopover] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const highlightClearRef = useRef<number | null>(null);

  const syncGraph = useCallback(async () => {
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/youtube/knowledge-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          title,
          channelTitle,
          contentType,
          markdown,
          ...(historyPackId ? { historyPackId } : {}),
        }),
      });
      const body = (await res.json()) as ApiResponse;
      if (!body.success || !body.graph) {
        setError(body.error ?? "Could not build knowledge graph");
        setBusy(false);
        return;
      }
      setGraph(body.graph);
      setPersisted(Boolean(body.persisted));
      setNeo4jConfigured(Boolean(body.neo4jConfigured));
      setWarning(body.warning ?? null);
      setViewMode("all");
      setSelectedId(null);
      setHops(1);
      setFollowPlayback(false);
      setSelectedLabels(new Set());
      setSelectedRelTypes(new Set());
      setBusy(false);
      onGraphReady?.(body.graph);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not build knowledge graph");
    }
  }, [videoId, title, channelTitle, contentType, markdown, historyPackId, onGraphReady]);

  useEffect(() => {
    if (seeded) return;
    void syncGraph();
  }, [seeded, syncGraph]);

  // Hydrate from parent cache when we have no local graph yet (e.g. history open).
  useEffect(() => {
    if (!seeded || !initialGraph) return;
    setGraph((prev) => (prev == null ? initialGraph : prev));
  }, [seeded, initialGraph]);

  // Reset when switching videos / history rows.
  useEffect(() => {
    setGraph(seeded ? initialGraph : null);
    setSelectedId(null);
    setRenameBusyId(null);
    setViewMode("all");
    setHops(1);
    setFollowPlayback(false);
    setSelectedLabels(new Set());
    setSelectedRelTypes(new Set());
    setError(null);
    setWarning(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- video/history switch only
  }, [videoId, historyPackId]);

  const visibleGraph = useMemo(() => {
    if (!graph) return null;
    let next = followPlayback ? focusByProgress(graph, playbackSec) : graph;
    if (viewMode === "neighbors" && selectedId) {
      next = focusNeighborhood(next, selectedId, hops);
    }
    if (selectedLabels.size > 0 || selectedRelTypes.size > 0) {
      next = focusByType(next, {
        labels: selectedLabels,
        relTypes: selectedRelTypes,
      });
    }
    return next;
  }, [
    graph,
    followPlayback,
    playbackSec,
    viewMode,
    selectedId,
    hops,
    selectedLabels,
    selectedRelTypes,
  ]);

  useEffect(() => {
    const nextIds = new Set(visibleGraph?.nodes.map((n) => n.id) ?? []);
    const appeared = newlyAppearedNodeIds(prevNodeIdsRef.current, nextIds);
    prevNodeIdsRef.current = nextIds;

    if (appeared.length === 0) return;

    setHighlightNodeIds(appeared);
    if (highlightClearRef.current != null) {
      window.clearTimeout(highlightClearRef.current);
    }
    highlightClearRef.current = window.setTimeout(() => {
      setHighlightNodeIds([]);
      highlightClearRef.current = null;
    }, HIGHLIGHT_MS);
  }, [visibleGraph]);

  useEffect(() => {
    return () => {
      if (highlightClearRef.current != null) {
        window.clearTimeout(highlightClearRef.current);
        highlightClearRef.current = null;
      }
    };
  }, []);

  const highlightSet = useMemo(
    () => new Set(highlightNodeIds),
    [highlightNodeIds],
  );

  const typeLegend = useMemo(() => {
    if (!graph) return { labels: {}, relTypes: {} };
    return {
      labels: countLabels(graph),
      relTypes: countRelTypes(graph),
    };
  }, [graph]);

  const toggleLabel = useCallback((label: string) => {
    if (label === "*") {
      setSelectedLabels(new Set());
      return;
    }
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const toggleRelType = useCallback((relType: string) => {
    if (relType === "*") {
      setSelectedRelTypes(new Set());
      return;
    }
    setSelectedRelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(relType)) next.delete(relType);
      else next.add(relType);
      return next;
    });
  }, []);

  const typeFocus: TypeFocusHandlers | undefined = graph
    ? {
        legend: typeLegend,
        selectedLabels,
        selectedRelTypes,
        onToggleLabel: toggleLabel,
        onToggleRelType: toggleRelType,
      }
    : undefined;

  const byId = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of visibleGraph?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [visibleGraph]);

  const fullById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of graph?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [graph]);

  const selectedNode = selectedId ? fullById.get(selectedId) ?? null : null;
  const selectedName = selectedNode ? nodeDisplayName(selectedNode) : null;

  const persistGraphPatch = useCallback(
    async (
      local: GraphPayload,
      body: Record<string, unknown>,
      opts?: { selectId?: string },
    ) => {
      if (opts?.selectId) setSelectedId(opts.selectId);
      setError(null);
      setWarning(null);
      setGraph(local);
      onGraphReady?.(local);
      setMutateBusy(true);
      try {
        const res = await fetch("/api/youtube/knowledge-graph", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            title,
            channelTitle,
            contentType,
            ...(historyPackId ? { historyPackId } : {}),
            graph: local,
            ...body,
          }),
        });
        const json = (await res.json()) as ApiResponse;
        if (!json.success || !json.graph) {
          setError(json.error ?? "Could not save graph edit");
          setMutateBusy(false);
          return;
        }
        setGraph(json.graph);
        setPersisted(Boolean(json.persisted));
        setNeo4jConfigured(Boolean(json.neo4jConfigured));
        setWarning(json.warning ?? null);
        setMutateBusy(false);
        onGraphReady?.(json.graph);
      } catch (e) {
        setMutateBusy(false);
        setError(e instanceof Error ? e.message : "Could not save graph edit");
      }
    },
    [videoId, title, channelTitle, contentType, historyPackId, onGraphReady],
  );

  const saveNodeLabel = useCallback(
    async (nodeId: string, nextLabel: string) => {
      if (!graph) return;
      const trimmed = nextLabel.trim();
      if (!trimmed) {
        setError("Label cannot be empty");
        return;
      }
      const current = fullById.get(nodeId);
      if (!current || trimmed === nodeDisplayName(current)) return;

      const local = renameGraphNode(graph, nodeId, trimmed);
      if (!local) {
        setError("Could not rename node");
        return;
      }

      setSelectedId(nodeId);
      setError(null);
      setWarning(null);
      setGraph(local);
      onGraphReady?.(local);

      setRenameBusyId(nodeId);
      try {
        const res = await fetch("/api/youtube/knowledge-graph", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "rename",
            videoId,
            nodeId,
            label: trimmed,
            graph: local,
            title,
            channelTitle,
            contentType,
            ...(historyPackId ? { historyPackId } : {}),
          }),
        });
        const body = (await res.json()) as ApiResponse;
        if (!body.success || !body.graph) {
          setError(body.error ?? "Could not save label");
          setRenameBusyId(null);
          return;
        }
        setGraph(body.graph);
        setPersisted(Boolean(body.persisted));
        setNeo4jConfigured(Boolean(body.neo4jConfigured));
        setWarning(body.warning ?? null);
        setRenameBusyId(null);
        onGraphReady?.(body.graph);
      } catch (e) {
        setRenameBusyId(null);
        setError(e instanceof Error ? e.message : "Could not save label");
      }
    },
    [
      graph,
      fullById,
      videoId,
      title,
      channelTitle,
      contentType,
      historyPackId,
      onGraphReady,
    ],
  );

  const commitAddNode = useCallback(
    async (input: { kind: GraphNodeKind; label: string }) => {
      if (!graph) return;
      const result = addGraphNode(graph, {
        domain: "youtube",
        kind: input.kind,
        label: input.label,
        scopeId: videoId,
      });
      if (!result) {
        setError("Could not add node");
        return;
      }
      setAddPopover(null);
      await persistGraphPatch(
        result.graph,
        { op: "addNode", kind: input.kind, label: input.label, graph },
        { selectId: result.nodeId },
      );
    },
    [graph, videoId, persistGraphPatch],
  );

  const commitConnect = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!graph) return;
      const result = addGraphLink(graph, {
        domain: "youtube",
        sourceId,
        targetId,
        type: "RELATED_TO",
      });
      if (!result) {
        setError("Could not connect those nodes (duplicate or invalid)");
        return;
      }
      await persistGraphPatch(result.graph, {
        op: "addLink",
        sourceId,
        targetId,
        type: "RELATED_TO",
        graph,
      });
    },
    [graph, persistGraphPatch],
  );

  const commitDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!graph) return;
      const next = deleteGraphNode(graph, nodeId);
      if (!next) {
        setError("Could not delete node");
        return;
      }
      setSelectedId(null);
      // Send pre-mutation graph so the server applies deleteNode once.
      await persistGraphPatch(next, {
        op: "deleteNode",
        nodeId,
        graph,
      });
    },
    [graph, persistGraphPatch],
  );

  const adjacency = useMemo(() => {
    if (!visibleGraph) return [];
    const seen = new Set<string>();
    return [...visibleGraph.nodes]
      .filter((n) => {
        if (n.labels.includes("YtVideo")) return false;
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      })
      .sort(
        (a, b) =>
          labelKind(a.labels).localeCompare(labelKind(b.labels)) ||
          nodeDisplayName(a).localeCompare(nodeDisplayName(b)),
      )
      .map((n) => ({
        node: n,
        kind: labelKind(n.labels),
        name: nodeDisplayName(n),
        linked: linkedTitles(n, visibleGraph.links, byId),
        startSec: nodeStartSec(n),
      }));
  }, [visibleGraph, byId]);

  const onSelectNode = (node: GraphNode, startSec: number | null) => {
    setSelectedId(node.id);
    if (startSec !== null && onSeek) onSeek(startSec);
  };

  const focusNeighborsOf = (node: GraphNode) => {
    setSelectedId(node.id);
    setViewMode("neighbors");
    const sec = nodeStartSec(node);
    if (sec !== null && onSeek) onSeek(sec);
  };

  const focusNeighborsById = (nodeId: string) => {
    const node = fullById.get(nodeId);
    if (node) {
      focusNeighborsOf(node);
      return;
    }
    setSelectedId(nodeId);
    setViewMode("neighbors");
  };

  const clearFocus = () => {
    setViewMode("all");
  };

  const clearTypeFocus = () => {
    setSelectedLabels(new Set());
    setSelectedRelTypes(new Set());
  };

  const neighborFocusing =
    viewMode === "neighbors" && selectedId && visibleGraph
      ? visibleGraph
      : null;

  const typeFocusActive =
    selectedLabels.size > 0 || selectedRelTypes.size > 0;

  const typeFocusParts: string[] = [];
  if (selectedLabels.size > 0) {
    typeFocusParts.push([...selectedLabels].join(", "));
  }
  if (selectedRelTypes.size > 0) {
    typeFocusParts.push([...selectedRelTypes].join(", "));
  }

  const footerHint = neighborFocusing
    ? `Focusing “${selectedName ?? "node"}” · ${hops} hop${hops === 1 ? "" : "s"}${typeFocusActive ? ` · ${typeFocusParts.join(" · ")}` : ""}${followPlayback ? ` · following ${formatPlaybackClock(playbackSec)}` : ""} · ${neighborFocusing.nodes.length} nodes · ${neighborFocusing.links.length} relationships`
    : typeFocusActive && visibleGraph
      ? `Focusing ${typeFocusParts.join(" · ")}${followPlayback ? ` · following ${formatPlaybackClock(playbackSec)}` : ""} · ${visibleGraph.nodes.length} nodes · ${visibleGraph.links.length} relationships`
      : followPlayback && visibleGraph
        ? `Following playback · ${formatPlaybackClock(playbackSec)} · ${visibleGraph.nodes.length} nodes · ${visibleGraph.links.length} relationships`
        : visibleGraph
          ? `${visibleGraph.nodes.length} nodes · ${visibleGraph.links.length} relationships`
          : undefined;

  const statusText =
    viewMode === "neighbors" && !selectedId
      ? "Select a node below to focus its neighborhood."
      : followPlayback &&
          visibleGraph &&
          visibleGraph.nodes.every((n) => n.labels.includes("YtVideo"))
        ? "Start playback or scrub to reveal concepts."
        : neighborFocusing || typeFocusActive || followPlayback
          ? footerHint
          : null;

  return (
    <section
      className={
        embedded
          ? undefined
          : "rounded-md border border-border bg-card px-3 py-3 shadow-xs"
      }
      aria-label="Knowledge graph"
      aria-busy={busy}
    >
      <div
        className={`flex flex-wrap items-start justify-between gap-2 ${embedded ? "mb-3" : "mb-2"}`}
      >
        {!embedded ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <Network className="size-3.5" aria-hidden />
            Knowledge graph
          </p>
        ) : (
          <p className="min-w-0 flex-1 text-[13px] leading-5 text-muted-foreground">
            {seeded && !neo4jConfigured
              ? "Loaded from saved pack. Refresh to rebuild or sync Neo4j."
              : `Noun key terms and timed concepts from this pack${
                  neo4jConfigured
                    ? persisted
                      ? " — saved to Neo4j."
                      : " — Neo4j connected; last save may have failed."
                    : " — shown locally (set NEO4J_* to persist)."
                }`}
          </p>
        )}
        <button
          type="button"
          onClick={() => void syncGraph()}
          disabled={busy}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh knowledge graph"
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {!embedded && (
        <p className="mb-3 text-[13px] leading-5 text-muted-foreground">
          Noun key terms and timed concepts from this pack
          {neo4jConfigured
            ? persisted
              ? " — saved to Neo4j."
              : " — Neo4j connected; last save may have failed."
            : " — shown locally (set NEO4J_* to persist)."}
        </p>
      )}
      {graph && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">View</span>
            <div
              className="inline-flex overflow-hidden rounded-md border border-border"
              role="group"
              aria-label="Graph view mode"
            >
              <SegmentButton
                pressed={viewMode === "all"}
                onClick={() => setViewMode("all")}
                ariaLabel="Show full graph"
              >
                All
              </SegmentButton>
              <SegmentButton
                pressed={viewMode === "neighbors"}
                onClick={() => setViewMode("neighbors")}
                ariaLabel="Focus neighbors of selected node"
              >
                Neighbors
              </SegmentButton>
            </div>

            {viewMode === "neighbors" && (
              <>
                <span className="text-[12px] font-medium text-muted-foreground">Hops</span>
                <div
                  className="inline-flex overflow-hidden rounded-md border border-border"
                  role="group"
                  aria-label="Neighborhood hop depth"
                >
                  <SegmentButton
                    pressed={hops === 1}
                    onClick={() => setHops(1)}
                    disabled={!selectedId}
                    ariaLabel="One hop"
                  >
                    1
                  </SegmentButton>
                  <SegmentButton
                    pressed={hops === 2}
                    onClick={() => setHops(2)}
                    disabled={!selectedId}
                    ariaLabel="Two hops"
                  >
                    2
                  </SegmentButton>
                </div>
              </>
            )}

            <span className="text-[12px] font-medium text-muted-foreground">Progress</span>
            <div
              className="inline-flex overflow-hidden rounded-md border border-border"
              role="group"
              aria-label="Follow video playback"
            >
              <SegmentButton
                pressed={!followPlayback}
                onClick={() => setFollowPlayback(false)}
                ariaLabel="Show all nodes regardless of playback"
              >
                Full
              </SegmentButton>
              <SegmentButton
                pressed={followPlayback}
                onClick={() => setFollowPlayback(true)}
                ariaLabel="Hide nodes until video reaches their timestamp"
              >
                Follow video
              </SegmentButton>
            </div>
          </div>

          {viewMode === "neighbors" && selectedName && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 py-1 pr-1 pl-2 text-[12px] text-foreground">
                <Focus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{selectedName}</span>
                <button
                  type="button"
                  onClick={clearFocus}
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  aria-label="Clear neighborhood focus"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            </div>
          )}

          {typeFocusActive && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 py-1 pr-1 pl-2 text-[12px] text-foreground">
                <Network className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{typeFocusParts.join(" · ")}</span>
                <button
                  type="button"
                  onClick={clearTypeFocus}
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  aria-label="Clear label and relationship type focus"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            </div>
          )}

          {statusText && (
            <p className="text-[12px] text-muted-foreground" role="status" aria-live="polite">
              {statusText}
            </p>
          )}
          {highlightNodeIds.length > 0 && (
            <p className="sr-only" role="status" aria-live="polite">
              {highlightNodeIds.length === 1
                ? "1 new node appeared"
                : `${highlightNodeIds.length} new nodes appeared`}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-2 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}
      {warning && !error && (
        <p className="mb-2 text-[13px] text-muted-foreground" role="status">
          Neo4j: {warning}
        </p>
      )}

      {busy && !graph && (
        <p
          className="flex items-center gap-1.5 py-8 text-[13px] text-muted-foreground"
          aria-live="polite"
        >
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Building graph…
        </p>
      )}

      {visibleGraph && (
        <div className="flex flex-col gap-3">
          {selectedNode ? (
            <SelectedNodeRenameBar
              kind={labelKind(selectedNode.labels)}
              value={selectedName ?? nodeDisplayName(selectedNode)}
              busy={renameBusyId === selectedNode.id}
              deleteBusy={mutateBusy}
              onCommit={(next) => saveNodeLabel(selectedNode.id, next)}
              onDelete={() => commitDeleteNode(selectedNode.id)}
            />
          ) : (
            <p className="text-[12px] leading-4 text-muted-foreground">
              Click empty canvas to add · Connect mode to link · select to rename or delete
            </p>
          )}
          {viewMode === "neighbors" && !selectedId ? (
            <div
              className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center"
              role="status"
            >
              <Focus className="size-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-[14px] font-medium text-foreground">
                Pick a node to focus
              </p>
              <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                Choose a concept or term in the list, or use Focus on a row, to show only its
                neighborhood.
              </p>
            </div>
          ) : (
            <ArcGraphCanvas
              graph={visibleGraph}
              footerHint={footerHint}
              onExpandNeighbors={focusNeighborsById}
              onNodeSelect={(id) => {
                setSelectedId(id);
              }}
              onCanvasEmptyClick={({ clientX, clientY }) => {
                setEditMode("select");
                setAddPopover({ x: clientX, y: clientY });
              }}
              onConnectNodes={(sourceId, targetId) => {
                void commitConnect(sourceId, targetId);
              }}
              editMode={editMode}
              onEditModeChange={setEditMode}
              typeFocus={typeFocus}
              layout={layout}
              highlightNodeIds={highlightNodeIds}
            />
          )}

          <div>
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
              <GitBranch className="size-3.5" aria-hidden />
              Nodes
              {viewMode === "neighbors" && selectedId ? " in focus" : ""}
            </p>
            <ul
              className="divide-y divide-border rounded-md border border-border bg-background"
              aria-label="Knowledge graph adjacency list"
            >
              {adjacency.length === 0 && (
                <li className="px-3 py-2 text-[13px] text-muted-foreground">
                  {viewMode === "neighbors" && !selectedId
                    ? "Select a node to list its neighbors."
                    : "No concepts or terms extracted from this pack."}
                </li>
              )}
              {adjacency.map((row) => {
                const selected = selectedId === row.node.id;
                const newlyAppeared = highlightSet.has(row.node.id);
                const seekable = row.startSec !== null && onSeek;
                return (
                  <li key={row.node.id}>
                    <div
                      className={`flex items-stretch gap-0 transition-colors duration-150 ${
                        newlyAppeared
                          ? "border-l-2 border-foreground bg-muted/70"
                          : selected
                            ? "bg-muted/70"
                            : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectNode(row.node, row.startSec)}
                            className="inline-flex h-5 cursor-pointer items-center rounded bg-secondary px-1.5 text-[11px] font-medium text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            aria-pressed={selected}
                            aria-label={`${row.kind}: ${row.name}${seekable ? `, seek to ${row.startSec}s` : ""}`}
                          >
                            {row.kind}
                          </button>
                          <InlineNodeLabel
                            value={row.name}
                            busy={renameBusyId === row.node.id}
                            onEditStart={() => setSelectedId(row.node.id)}
                            onCommit={(next) => saveNodeLabel(row.node.id, next)}
                            ariaLabel={`Rename ${row.kind} ${row.name}`}
                          />
                          {row.startSec !== null && (
                            <button
                              type="button"
                              onClick={() => onSelectNode(row.node, row.startSec)}
                              className="cursor-pointer font-mono text-[11px] tabular-nums text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {typeof row.node.properties.timestampLabel === "string"
                                ? row.node.properties.timestampLabel
                                : `[${Math.floor(row.startSec / 60)}:${String(row.startSec % 60).padStart(2, "0")}]`}
                            </button>
                          )}
                        </span>
                        {row.linked.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onSelectNode(row.node, row.startSec)}
                            className="line-clamp-1 cursor-pointer text-left text-[12px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            Linked: {row.linked.join(" · ")}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => focusNeighborsOf(row.node)}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 border-l border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                        aria-label={`Focus neighbors of ${row.name}`}
                        title="Focus neighbors"
                      >
                        <Focus className="size-3.5" aria-hidden />
                        Focus
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      {addPopover ? (
        <AddNodePopover
          x={addPopover.x}
          y={addPopover.y}
          kinds={[
            { value: "YtConcept", label: "Concept" },
            { value: "YtGlossaryTerm", label: "Term" },
          ]}
          defaultKind="YtConcept"
          busy={mutateBusy}
          onCommit={commitAddNode}
          onCancel={() => setAddPopover(null)}
        />
      ) : null}
    </section>
  );
}
