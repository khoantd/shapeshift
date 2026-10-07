"use client";

import dynamic from "next/dynamic";
import type { GraphPayload } from "@/lib/neo4j/types";
import type { TypeFocusHandlers } from "./ClickableOverviewPane";
import type { GraphEditMode } from "./arc-graph-canvas-inner";
import {
  ARC_CANVAS_HEIGHT_CLASS,
  ARC_FILL_CANVAS_HEIGHT_CLASS,
  ARC_SIDEBAR_CANVAS_HEIGHT_CLASS,
  ARC_TEASER_CANVAS_HEIGHT_CLASS,
} from "./arc-layout";

const ArcGraphCanvasInner = dynamic(
  () => import("./arc-graph-canvas-inner").then((m) => m.ArcGraphCanvasInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        Loading graph…
      </div>
    ),
  },
);

export type { GraphEditMode };

/** High-contrast ring pulse for nodes that just appeared (Follow video / filters). */
const APPEAR_HIGHLIGHT_CSS = `
@keyframes yt-node-appear {
  0% { opacity: 0.15; }
  40% { opacity: 0.65; }
  100% { opacity: 0.45; }
}
g.node.newly-appeared > circle.ring {
  stroke: #1a1a1a;
  stroke-width: 8px;
  opacity: 0.55;
  animation: yt-node-appear 0.8s ease-out 2;
}
@media (prefers-reduced-motion: reduce) {
  g.node.newly-appeared > circle.ring {
    animation: none;
    opacity: 0.5;
  }
}
`;

function ModeToolbar({
  editMode,
  onEditModeChange,
}: {
  editMode: GraphEditMode;
  onEditModeChange?: (mode: GraphEditMode) => void;
}) {
  if (!onEditModeChange) return null;
  return (
    <div
      className="absolute top-2 left-2 z-10 flex gap-0.5 rounded-md border border-border bg-background/95 p-0.5 shadow-sm"
      role="group"
      aria-label="Graph edit mode"
    >
      <button
        type="button"
        onClick={() => onEditModeChange("select")}
        aria-pressed={editMode === "select"}
        className={`inline-flex h-7 cursor-pointer items-center rounded px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          editMode === "select"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        Select
      </button>
      <button
        type="button"
        onClick={() => onEditModeChange("connect")}
        aria-pressed={editMode === "connect"}
        className={`inline-flex h-7 cursor-pointer items-center rounded px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          editMode === "connect"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        Connect
      </button>
    </div>
  );
}

export function ArcGraphCanvas({
  graph,
  footerHint,
  onExpandNeighbors,
  onNodeSelect,
  onCanvasEmptyClick,
  onConnectNodes,
  editMode = "select",
  onEditModeChange,
  typeFocus,
  layout = "default",
  highlightNodeIds,
}: {
  graph: GraphPayload;
  footerHint?: string;
  onExpandNeighbors?: (nodeId: string) => void;
  onNodeSelect?: (
    nodeId: string,
    labels: string[],
    properties: Record<string, unknown>,
  ) => void;
  onCanvasEmptyClick?: (point: { clientX: number; clientY: number }) => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  editMode?: GraphEditMode;
  onEditModeChange?: (mode: GraphEditMode) => void;
  typeFocus?: TypeFocusHandlers;
  layout?: "default" | "sidebar" | "teaser" | "fill";
  highlightNodeIds?: string[];
}) {
  const heightClass =
    layout === "teaser"
      ? ARC_TEASER_CANVAS_HEIGHT_CLASS
      : layout === "sidebar"
        ? ARC_SIDEBAR_CANVAS_HEIGHT_CLASS
        : layout === "fill"
          ? ARC_FILL_CANVAS_HEIGHT_CLASS
          : ARC_CANVAS_HEIGHT_CLASS;
  const nodeCount = graph.nodes.length;
  const linkCount = graph.links.length;
  const typeFocusActive =
    Boolean(typeFocus) &&
    ((typeFocus?.selectedLabels.size ?? 0) > 0 ||
      (typeFocus?.selectedRelTypes.size ?? 0) > 0);

  if (nodeCount === 0) {
    return (
      <div
        className={`relative flex ${heightClass} flex-col overflow-hidden rounded-md border border-dashed border-border`}
      >
        <ModeToolbar editMode={editMode} onEditModeChange={onEditModeChange} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 px-4 text-center text-[13px] text-muted-foreground">
          <p>
            {typeFocusActive
              ? "No nodes match the selected labels or relationship types."
              : "No nodes in this graph"}
          </p>
          {!typeFocusActive && onCanvasEmptyClick ? (
            <button
              type="button"
              onClick={(e) =>
                onCanvasEmptyClick({
                  clientX: e.clientX,
                  clientY: e.clientY,
                })
              }
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Click to add a node
            </button>
          ) : null}
          {typeFocusActive && typeFocus && (
            <button
              type="button"
              onClick={() => {
                typeFocus.onToggleLabel("*");
                typeFocus.onToggleRelType("*");
              }}
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Clear type focus
            </button>
          )}
        </div>
        <div className="shrink-0 border-t border-border bg-muted/40 px-3 py-1.5 text-[12px] text-muted-foreground">
          0 nodes · 0 relationships
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${heightClass} flex-col overflow-hidden rounded-md border border-border bg-[#F9FCFF]`}
    >
      <style dangerouslySetInnerHTML={{ __html: APPEAR_HIGHLIGHT_CSS }} />
      <ModeToolbar editMode={editMode} onEditModeChange={onEditModeChange} />
      <div className="relative min-h-0 flex-1">
        <ArcGraphCanvasInner
          graph={graph}
          onExpandNeighbors={onExpandNeighbors}
          onNodeSelect={onNodeSelect}
          onCanvasEmptyClick={onCanvasEmptyClick}
          onConnectNodes={onConnectNodes}
          editMode={editMode}
          typeFocus={typeFocus}
          highlightNodeIds={highlightNodeIds}
        />
      </div>
      <div className="shrink-0 border-t border-border bg-muted/40 px-3 py-1.5 text-[12px] text-muted-foreground">
        {footerHint ?? `${nodeCount} nodes · ${linkCount} relationships`}
        {editMode === "connect"
          ? " · Drag from one node to another to connect"
          : ""}
      </div>
    </div>
  );
}
