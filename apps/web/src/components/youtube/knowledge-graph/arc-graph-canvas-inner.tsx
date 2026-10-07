"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArcThemeProvider } from "neo4j-arc/common";
import { GraphVisualizer } from "neo4j-arc/graph-visualization";
import type { GraphPayload } from "@/lib/neo4j/types";
import {
  createClickableOverviewPane,
  type TypeFocusHandlers,
} from "./ClickableOverviewPane";
import { toBasicGraph } from "./to-basic-graph";

type ArcVisualization = {
  zoomByType?: (type: "in" | "out" | "fit") => void;
};

export type GraphEditMode = "select" | "connect";

type Props = {
  graph: GraphPayload;
  onNodeSelect?: (
    nodeId: string,
    labels: string[],
    properties: Record<string, unknown>,
  ) => void;
  onExpandNeighbors?: (nodeId: string) => void;
  onCanvasEmptyClick?: (point: { clientX: number; clientY: number }) => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  editMode?: GraphEditMode;
  typeFocus?: TypeFocusHandlers;
  highlightNodeIds?: string[];
};

type D3NodeDatum = { id?: string; x?: number; y?: number };

function applyNewlyAppearedClass(
  root: HTMLElement,
  highlightIds: ReadonlySet<string>,
): void {
  for (const el of root.querySelectorAll("g.node")) {
    const data = (el as SVGElement & { __data__?: D3NodeDatum }).__data__;
    const id = data?.id;
    if (id && highlightIds.has(id)) {
      el.classList.add("newly-appeared");
    } else {
      el.classList.remove("newly-appeared");
    }
  }
}

function nodeIdFromEventTarget(
  target: EventTarget | null,
  root: HTMLElement,
): string | null {
  if (!(target instanceof Element)) return null;
  const nodeEl = target.closest("g.node");
  if (!nodeEl || !root.contains(nodeEl)) return null;
  const data = (nodeEl as SVGElement & { __data__?: D3NodeDatum }).__data__;
  return data?.id ?? null;
}

function nodeCenterInRoot(
  root: HTMLElement,
  nodeId: string,
): { x: number; y: number } | null {
  for (const el of root.querySelectorAll("g.node")) {
    const data = (el as SVGElement & { __data__?: D3NodeDatum }).__data__;
    if (data?.id !== nodeId) continue;
    const rect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - rootRect.left,
      y: rect.top + rect.height / 2 - rootRect.top,
    };
  }
  return null;
}

export function ArcGraphCanvasInner({
  graph,
  onNodeSelect,
  onExpandNeighbors,
  onCanvasEmptyClick,
  onConnectNodes,
  editMode = "select",
  typeFocus,
  highlightNodeIds = [],
}: Props) {
  const { nodes, relationships } = useMemo(() => toBasicGraph(graph), [graph]);
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<ArcVisualization | null>(null);
  const fitTimersRef = useRef<number[]>([]);
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;
  const onExpandNeighborsRef = useRef(onExpandNeighbors);
  onExpandNeighborsRef.current = onExpandNeighbors;
  const onCanvasEmptyClickRef = useRef(onCanvasEmptyClick);
  onCanvasEmptyClickRef.current = onCanvasEmptyClick;
  const onConnectNodesRef = useRef(onConnectNodes);
  onConnectNodesRef.current = onConnectNodes;
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  /** Survives GraphVisualizer remounts when graphKey changes (Follow video, filters). */
  const [overviewExpanded, setOverviewExpanded] = useState(true);
  const [rubber, setRubber] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const connectSourceRef = useRef<string | null>(null);

  const typeFocusRef = useRef<TypeFocusHandlers>(
    typeFocus ?? {
      legend: { labels: {}, relTypes: {} },
      selectedLabels: new Set(),
      selectedRelTypes: new Set(),
      onToggleLabel: () => undefined,
      onToggleRelType: () => undefined,
    },
  );
  if (typeFocus) {
    typeFocusRef.current = typeFocus;
  }

  const OverviewPaneOverride = useMemo(
    () => (typeFocus ? createClickableOverviewPane(typeFocusRef) : undefined),
    // Stable for the lifetime of typeFocus being enabled
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref-based handlers
    [Boolean(typeFocus)],
  );

  const clearFitTimers = useCallback(() => {
    for (const id of fitTimersRef.current) {
      window.clearTimeout(id);
    }
    fitTimersRef.current = [];
  }, []);

  const fitGraph = useCallback(() => {
    vizRef.current?.zoomByType?.("fit");
  }, []);

  const scheduleFits = useCallback(() => {
    clearFitTimers();
    const delays = [0, 80, 250, 600, 1200];
    fitTimersRef.current = delays.map((ms) =>
      window.setTimeout(() => {
        fitGraph();
      }, ms),
    );
  }, [clearFitTimers, fitGraph]);

  const assignVisElement = useCallback(
    (_svg: unknown, visualization: unknown) => {
      vizRef.current = visualization as ArcVisualization;
      scheduleFits();
    },
    [scheduleFits],
  );

  useEffect(() => {
    scheduleFits();
    return clearFitTimers;
  }, [graph, scheduleFits, clearFitTimers]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    let debounceId = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        fitGraph();
      }, 120);
    });
    observer.observe(el);
    return () => {
      window.clearTimeout(debounceId);
      observer.disconnect();
    };
  }, [fitGraph]);

  // Remount when topology OR display labels change (rename keeps counts the same).
  const graphKey = useMemo(() => {
    const first = graph.nodes[0]?.id ?? "empty";
    let labelSig = 0;
    for (const n of graph.nodes) {
      const name =
        (typeof n.properties.name === "string" && n.properties.name) ||
        n.label ||
        "";
      for (let i = 0; i < name.length; i++) {
        labelSig = (labelSig * 31 + name.charCodeAt(i)) | 0;
      }
      labelSig = (labelSig * 31 + 7) | 0;
    }
    return `${first}:${graph.nodes.length}:${graph.links.length}:${labelSig}`;
  }, [graph]);

  // Select mode: node click → parent; empty click → add-node.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      if (editModeRef.current === "connect") return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const nodeId = nodeIdFromEventTarget(target, root);
      if (nodeId) {
        if (!onNodeSelectRef.current) return;
        const graphNode = graph.nodes.find((n) => n.id === nodeId);
        onNodeSelectRef.current(
          nodeId,
          graphNode?.labels ?? [],
          graphNode?.properties ?? {},
        );
        return;
      }

      // Ignore chrome / inspector clicks
      if (
        target.closest("button") ||
        target.closest("[role='button']") ||
        target.closest(".node-inspector") ||
        target.closest("input") ||
        target.closest("select")
      ) {
        return;
      }

      onCanvasEmptyClickRef.current?.({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [graph, graphKey]);

  // Connect mode: drag rubber-band from node → node.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || editMode !== "connect") {
      connectSourceRef.current = null;
      setRubber(null);
      return;
    }

    const hitNodeId = (clientX: number, clientY: number): string | null => {
      // With setPointerCapture, event.target is the capture root — hit-test by point.
      const el = document.elementFromPoint(clientX, clientY);
      return nodeIdFromEventTarget(el, root);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const id = hitNodeId(event.clientX, event.clientY);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      const center = nodeCenterInRoot(root, id);
      if (!center) return;
      connectSourceRef.current = id;
      setRubber({ x1: center.x, y1: center.y, x2: center.x, y2: center.y });
      try {
        root.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!connectSourceRef.current) return;
      const rootRect = root.getBoundingClientRect();
      setRubber((prev) =>
        prev
          ? {
              ...prev,
              x2: event.clientX - rootRect.left,
              y2: event.clientY - rootRect.top,
            }
          : null,
      );
    };

    const finish = (event: PointerEvent) => {
      const source = connectSourceRef.current;
      connectSourceRef.current = null;
      setRubber(null);
      try {
        if (root.hasPointerCapture(event.pointerId)) {
          root.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }
      if (!source) return;
      const target = hitNodeId(event.clientX, event.clientY);
      if (!target || target === source) return;
      onConnectNodesRef.current?.(source, target);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        connectSourceRef.current = null;
        setRubber(null);
      }
    };

    root.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown, true);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", finish);
      root.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", onKey);
    };
  }, [editMode, graphKey]);

  const highlightKey = highlightNodeIds.join("\0");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ids = new Set(highlightNodeIds);
    const apply = () => applyNewlyAppearedClass(el, ids);
    apply();
    const t1 = window.setTimeout(apply, 120);
    const t2 = window.setTimeout(apply, 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // graphKey: re-apply after GraphVisualizer remount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlightNodeIds via highlightKey
  }, [highlightKey, graphKey, highlightNodeIds]);

  const getNeighbours = useCallback(
    async (id: string, _currentNeighbourIds: string[] | undefined) => {
      onExpandNeighborsRef.current?.(id);
      // Neighbors focus is handled by the panel filter; Arc's expand path
      // only needs a resolved promise so the menu action does not hang.
      return { nodes: [], relationships: [], allNeighboursCount: 0 };
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full ${
        editMode === "connect" ? "cursor-crosshair" : ""
      }`}
    >
      <div className="h-full w-full [&_.neod3viz]:h-full [&_.neod3viz]:w-full motion-reduce:[&_*]:!transition-none">
        <ArcThemeProvider>
          <GraphVisualizer
            key={graphKey}
            nodes={nodes}
            relationships={relationships}
            autocompleteRelationships={false}
            initialZoomToFit
            useGeneratedDefaultColors
            assignVisElement={assignVisElement}
            getNeighbours={getNeighbours}
            OverviewPaneOverride={OverviewPaneOverride}
            nodePropertiesExpandedByDefault={overviewExpanded}
            setNodePropertiesExpandedByDefault={setOverviewExpanded}
          />
        </ArcThemeProvider>
      </div>
      {rubber ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          <line
            x1={rubber.x1}
            y1={rubber.y1}
            x2={rubber.x2}
            y2={rubber.y2}
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 3"
            className="text-foreground/70"
          />
        </svg>
      ) : null}
    </div>
  );
}
