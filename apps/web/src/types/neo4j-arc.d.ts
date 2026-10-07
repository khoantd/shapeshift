declare module "neo4j-arc/common" {
  import type { FC, ReactNode, CSSProperties } from "react";

  export type BasicNode = {
    id: string;
    elementId: string;
    labels: string[];
    properties: Record<string, string>;
    propertyTypes: Record<string, string>;
  };

  export type BasicRelationship = {
    id: string;
    elementId: string;
    startNodeId: string;
    endNodeId: string;
    type: string;
    properties: Record<string, string>;
    propertyTypes: Record<string, string>;
  };

  export type BasicNodesAndRels = {
    nodes: BasicNode[];
    relationships: BasicRelationship[];
  };

  export const ArcThemeProvider: FC<{
    children: ReactNode;
    theme?: Record<string, string>;
  }>;

  export function numberToUSLocale(value: number | null): string;

  export const ShowMoreOrAll: FC<{
    total: number;
    shown: number;
    moreStep: number;
    onMore: (numMore: number) => void;
  }>;

  export const WarningMessage: FC<{ text: string }>;

  type ChipProps = {
    as?: string;
    type?: string;
    onClick?: () => void;
    "aria-pressed"?: boolean;
    "aria-label"?: string;
    style?: CSSProperties;
    children?: ReactNode;
  };

  export const StyledLabelChip: FC<ChipProps>;
  export const StyledRelationshipChip: FC<ChipProps>;
  export const StyledPropertyChip: FC<ChipProps>;
}

declare module "neo4j-arc/graph-visualization" {
  import type { ComponentType, FC } from "react";
  import type {
    BasicNode,
    BasicNodesAndRels,
    BasicRelationship,
  } from "neo4j-arc/common";

  export type StyleElement = {
    get: (key: string) => string;
  };

  export type GraphStyleModel = {
    forNode: (node?: { labels?: string[] }) => StyleElement;
    forRelationship: (rel: { type: string }) => StyleElement;
  };

  export type GraphStats = {
    labels?: Record<string, { count: number; properties: Record<string, string> }>;
    relTypes?: Record<
      string,
      { count: number; properties: Record<string, string> }
    >;
  };

  export type OverviewPaneProps = {
    graphStyle: GraphStyleModel;
    hasTruncatedFields: boolean;
    nodeCount: number | null;
    relationshipCount: number | null;
    stats: GraphStats;
    infoMessage: string | null;
  };

  export type GraphVisualizerProps = {
    nodes: BasicNode[];
    relationships: BasicRelationship[];
    autocompleteRelationships: boolean;
    initialZoomToFit?: boolean;
    useGeneratedDefaultColors?: boolean;
    maxNeighbours?: number;
    isFullscreen?: boolean;
    assignVisElement?: (svgElement: unknown, visualization: unknown) => void;
    getNeighbours?: (
      id: string,
      currentNeighbourIds: string[] | undefined,
    ) => Promise<BasicNodesAndRels & { allNeighboursCount: number }>;
    OverviewPaneOverride?: FC<OverviewPaneProps>;
    /** Seed inspector open/closed; remounts rehydrate from this value. */
    nodePropertiesExpandedByDefault?: boolean;
    setNodePropertiesExpandedByDefault?: (expandedByDefault: boolean) => void;
  };

  export const GraphVisualizer: ComponentType<GraphVisualizerProps>;
}
