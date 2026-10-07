"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  countLabels,
  countRelTypes,
  focusByType,
  focusNeighborhood,
  type NeighborhoodHops,
} from "@/lib/youtube/graphNeighborhood";
import { AddNodePopover } from "@/components/knowledge-graph/AddNodePopover";
import { InlineNodeLabel } from "@/components/knowledge-graph/InlineNodeLabel";
import { SelectedNodeRenameBar } from "@/components/knowledge-graph/SelectedNodeRenameBar";
import {
  ArcGraphCanvas,
  type GraphEditMode,
} from "@/components/youtube/knowledge-graph/arc-graph-canvas";
import type { TypeFocusHandlers } from "@/components/youtube/knowledge-graph/ClickableOverviewPane";

type Props = {
  storyId: string;
  title: string;
  canonicalUrl: string;
  deepDiveText: string;
  briefLine?: string;
  sources: Array<{ title: string; url: string }>;
  initialGraph?: GraphPayload | null;
  signedIn: boolean;
  onSignIn: () => void;
  onGraphReady?: (graph: GraphPayload, meta: { historySaved: boolean }) => void;
  embedded?: boolean;
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
  if (labels.includes("NewsArticle")) return "Article";
  if (labels.includes("NewsConcept")) return "Concept";
  if (labels.includes("NewsEntity")) return "Entity";
  if (labels.includes("NewsSource")) return "Source";
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

function SegmentButton({
  pressed,
  onClick,
  children,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
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

export function NewsKnowledgeGraphPanel({
  storyId,
  title,
  canonicalUrl,
  deepDiveText,
  briefLine,
  sources,
  initialGraph = null,
  signedIn,
  onSignIn,
  onGraphReady,
  embedded = true,
}: Props) {
  const seeded =
    initialGraph != null &&
    Array.isArray(initialGraph.nodes) &&
    initialGraph.nodes.length > 0;

  const [graph, setGraph] = useState<GraphPayload | null>(seeded ? initialGraph : null);
  const [busy, setBusy] = useState(false);
  const [renameBusyId, setRenameBusyId] = useState<string | null>(null);
  const [mutateBusy, setMutateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [historySaved, setHistorySaved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [hops, setHops] = useState<NeighborhoodHops>(1);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(() => new Set());
  const [selectedRelTypes, setSelectedRelTypes] = useState<Set<string>>(
    () => new Set(),
  );
  const [editMode, setEditMode] = useState<GraphEditMode>("select");
  const [addPopover, setAddPopover] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const canBuild = Boolean(deepDiveText.trim() || briefLine?.trim());

  const syncGraph = useCallback(async () => {
    if (!canBuild) {
      setError("Generate a deep dive (or brief) before building the graph.");
      return;
    }
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/news/knowledge-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          title,
          canonicalUrl,
          deepDiveText,
          briefLine,
          sources,
          save: true,
        }),
      });
      const body = (await res.json()) as ApiResponse;
      if (!body.success || !body.graph) {
        setError(body.error ?? "Could not build knowledge graph");
        setBusy(false);
        return;
      }
      setGraph(body.graph);
      setHistorySaved(Boolean(body.historySaved));
      setWarning(body.warning ?? null);
      setViewMode("all");
      setSelectedId(null);
      setHops(1);
      setSelectedLabels(new Set());
      setSelectedRelTypes(new Set());
      setBusy(false);
      onGraphReady?.(body.graph, { historySaved: Boolean(body.historySaved) });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not build knowledge graph");
    }
  }, [
    canBuild,
    storyId,
    title,
    canonicalUrl,
    deepDiveText,
    briefLine,
    sources,
    onGraphReady,
  ]);

  // Reset when switching articles. Do not re-sync on every initialGraph identity
  // change — that races with GET hydration and wipes in-session renames.
  useEffect(() => {
    setGraph(seeded ? initialGraph : null);
    setSelectedId(null);
    setViewMode("all");
    setHops(1);
    setSelectedLabels(new Set());
    setSelectedRelTypes(new Set());
    setHistorySaved(false);
    setError(null);
    setWarning(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- story switch only
  }, [storyId]);

  // Hydrate from parent cache / GET only when we have no local graph yet.
  useEffect(() => {
    if (!seeded || !initialGraph) return;
    setGraph((prev) => (prev == null ? initialGraph : prev));
  }, [seeded, initialGraph]);

  const visibleGraph = useMemo(() => {
    if (!graph) return null;
    let next = graph;
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
  }, [graph, viewMode, selectedId, hops, selectedLabels, selectedRelTypes]);

  const typeFocusHandlers = useMemo<TypeFocusHandlers>(
    () => ({
      legend: {
        labels: graph ? countLabels(graph) : {},
        relTypes: graph ? countRelTypes(graph) : {},
      },
      selectedLabels,
      selectedRelTypes,
      onToggleLabel: (label) => {
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
      },
      onToggleRelType: (relType) => {
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
      },
    }),
    [graph, selectedLabels, selectedRelTypes],
  );

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
      onGraphReady?.(local, { historySaved: false });
      setMutateBusy(true);
      try {
        const res = await fetch("/api/news/knowledge-graph", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            title,
            canonicalUrl,
            deepDiveText,
            save: true,
            // Prefer explicit graph from body (pre-mutation base for add ops).
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
        setHistorySaved(Boolean(json.historySaved));
        setWarning(
          json.warning ??
            (!json.signedIn
              ? "Graph updated locally. Sign in to save across sessions."
              : null),
        );
        setMutateBusy(false);
        onGraphReady?.(json.graph, { historySaved: Boolean(json.historySaved) });
      } catch (e) {
        setMutateBusy(false);
        setError(e instanceof Error ? e.message : "Could not save graph edit");
      }
    },
    [storyId, title, canonicalUrl, deepDiveText, onGraphReady],
  );

  const saveNodeLabel = useCallback(
    async (nodeId: string, nextLabel: string) => {
      if (!graph) return;
      const trimmed = nextLabel.trim();
      if (!trimmed) {
        setError("Label cannot be empty");
        throw new Error("Label cannot be empty");
      }
      const current = fullById.get(nodeId);
      if (!current || trimmed === nodeDisplayName(current)) return;

      const local = renameGraphNode(graph, nodeId, trimmed);
      if (!local) {
        setError("Could not rename node");
        throw new Error("Could not rename node");
      }

      setSelectedId(nodeId);
      setError(null);
      setWarning(null);
      setGraph(local);
      onGraphReady?.(local, { historySaved: false });

      setRenameBusyId(nodeId);
      try {
        const res = await fetch("/api/news/knowledge-graph", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "rename",
            storyId,
            nodeId,
            label: trimmed,
            graph: local,
            title,
            canonicalUrl,
            deepDiveText,
            save: true,
          }),
        });
        const body = (await res.json()) as ApiResponse;
        if (!body.success || !body.graph) {
          setError(body.error ?? "Could not save label");
          setRenameBusyId(null);
          return;
        }
        setGraph(body.graph);
        setHistorySaved(Boolean(body.historySaved));
        setWarning(
          body.warning ??
            (!body.signedIn
              ? "Label updated locally. Sign in to save across sessions."
              : null),
        );
        setRenameBusyId(null);
        onGraphReady?.(body.graph, { historySaved: Boolean(body.historySaved) });
      } catch (e) {
        setRenameBusyId(null);
        setError(e instanceof Error ? e.message : "Could not save label");
      }
    },
    [
      graph,
      fullById,
      storyId,
      title,
      canonicalUrl,
      deepDiveText,
      onGraphReady,
    ],
  );

  const commitAddNode = useCallback(
    async (input: { kind: GraphNodeKind; label: string }) => {
      if (!graph) return;
      const result = addGraphNode(graph, {
        domain: "news",
        kind: input.kind,
        label: input.label,
        scopeId: storyId,
      });
      if (!result) {
        setError("Could not add node");
        return;
      }
      setAddPopover(null);
      // Send pre-mutation graph so the server can apply addNode once.
      await persistGraphPatch(result.graph, {
        op: "addNode",
        kind: input.kind,
        label: input.label,
        graph,
      }, { selectId: result.nodeId });
    },
    [graph, storyId, persistGraphPatch],
  );

  const commitConnect = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!graph) return;
      const result = addGraphLink(graph, {
        domain: "news",
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

  const selected = selectedId ? fullById.get(selectedId) ?? null : null;

  const shellClass = embedded
    ? "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    : "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3";

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          <Network className="size-3.5" aria-hidden />
          Knowledge graph
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {!signedIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-2.5 text-[12px] font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign in to save
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void syncGraph()}
            disabled={busy || !canBuild}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 text-[12px] font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={graph ? "Refresh knowledge graph" : "Build knowledge graph"}
          >
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {graph ? "Refresh" : "Build graph"}
          </button>
        </div>
      </div>

      {!canBuild ? (
        <p className="text-[14px] leading-5 text-muted-foreground">
          Generate a deep dive first, then build a personal knowledge graph from this
          story.
        </p>
      ) : null}

      {error ? (
        <p className="text-[13px] leading-5 text-[var(--caution)]" role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="text-[12px] leading-4 text-muted-foreground">{warning}</p>
      ) : null}
      {historySaved ? (
        <p className="text-[12px] leading-4 text-muted-foreground">Saved to your knowledge.</p>
      ) : null}

      {graph && visibleGraph ? (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <SegmentButton
              pressed={viewMode === "all"}
              onClick={() => setViewMode("all")}
            >
              All
            </SegmentButton>
            <SegmentButton
              pressed={viewMode === "neighbors"}
              onClick={() => setViewMode("neighbors")}
              disabled={!selectedId}
            >
              Neighbors
            </SegmentButton>
            {viewMode === "neighbors" ? (
              <>
                <SegmentButton pressed={hops === 1} onClick={() => setHops(1)}>
                  1 hop
                </SegmentButton>
                <SegmentButton pressed={hops === 2} onClick={() => setHops(2)}>
                  2 hops
                </SegmentButton>
              </>
            ) : null}
            {selectedId ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-muted"
              >
                <X className="size-3" aria-hidden />
                Clear focus
              </button>
            ) : null}
          </div>

          {selected ? (
            <SelectedNodeRenameBar
              kind={labelKind(selected.labels)}
              value={nodeDisplayName(selected)}
              busy={renameBusyId === selected.id}
              deleteBusy={mutateBusy}
              onCommit={(next) => saveNodeLabel(selected.id, next)}
              onDelete={() => commitDeleteNode(selected.id)}
            />
          ) : (
            <p className="shrink-0 text-[12px] leading-4 text-muted-foreground">
              Click empty canvas to add · Connect mode to link · select to rename or delete
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
            <ArcGraphCanvas
              graph={visibleGraph}
              onExpandNeighbors={(id) => {
                setSelectedId(id);
                setViewMode("neighbors");
              }}
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
              typeFocus={typeFocusHandlers}
              layout="fill"
              footerHint={`${visibleGraph.nodes.length} nodes · ${visibleGraph.links.length} relationships`}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-background pt-2">
            <ul
              className="max-h-[min(28vh,11rem)] space-y-1 overflow-y-auto text-[13px] leading-5"
              aria-label="Graph adjacency list"
            >
              {(visibleGraph.nodes ?? []).slice(0, 40).map((node) => {
                const related = linkedTitles(node, visibleGraph.links, byId);
                const name = nodeDisplayName(node);
                const selected = selectedId === node.id;
                return (
                  <li key={node.id}>
                    <div
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${
                        selected ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(node.id)}
                        className="mt-0.5 shrink-0 cursor-pointer text-[10px] font-medium tracking-wide text-muted-foreground uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-pressed={selected}
                        aria-label={`Select ${labelKind(node.labels)} ${name}`}
                      >
                        {labelKind(node.labels)}
                      </button>
                      <div className="min-w-0 flex-1">
                        <InlineNodeLabel
                          value={name}
                          busy={renameBusyId === node.id}
                          onEditStart={() => setSelectedId(node.id)}
                          onCommit={(next) => saveNodeLabel(node.id, next)}
                          ariaLabel={`Rename ${labelKind(node.labels)} ${name}`}
                          className="text-ink-2"
                        />
                        {related.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedId(node.id)}
                            className="mt-0.5 block w-full cursor-pointer text-left text-[12px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            → {related.join(", ")}
                          </button>
                        ) : null}
                      </div>
                      {selected ? (
                        <Focus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <GitBranch className="mt-0.5 size-3.5 shrink-0 opacity-0" aria-hidden />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : busy ? (
        <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Building graph…
        </p>
      ) : null}
      {addPopover ? (
        <AddNodePopover
          x={addPopover.x}
          y={addPopover.y}
          kinds={[
            { value: "NewsConcept", label: "Concept" },
            { value: "NewsEntity", label: "Entity" },
            { value: "NewsSource", label: "Source" },
          ]}
          defaultKind="NewsConcept"
          busy={mutateBusy}
          onCommit={commitAddNode}
          onCancel={() => setAddPopover(null)}
        />
      ) : null}
    </div>
  );
}
