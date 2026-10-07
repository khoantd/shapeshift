export type GraphNode = {
  id: string;
  label: string;
  labels: string[];
  properties: Record<string, unknown>;
};

export type GraphLink = {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
};

export type GraphPayload = {
  nodes: GraphNode[];
  links: GraphLink[];
};
