export type GalaxyNodeState = 'completed' | 'recommended' | 'blocked' | 'future' | 'core';

export type GalaxyEdgeType = 'unlock' | 'dependency';

export type SpatialGraphNode<TPayload = unknown> = {
  id: string;
  x: number;
  y: number;
  status: GalaxyNodeState;
  payload: TPayload | null;
};

export type SpatialGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: GalaxyEdgeType;
};

export type GalaxyOrbitRing = {
  rx: number;
  ry: number;
};

export type GalaxyNodeVisualState = {
  isJourneyNode: boolean;
  isSelected: boolean;
  isNeighbor: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  isConstrainedDownstream: boolean;
  isOneHopActive: boolean;
  isTwoHopDim: boolean;
  isPrimaryRecommended: boolean;
  isLocked: boolean;
  isDependencySourceHighlight: boolean;
};

export type GalaxyEdgeVisualState = {
  isHighlighted: boolean;
  isCausalUnlock: boolean;
  isCausalDependency: boolean;
  isSelectionContext: boolean;
  isPrimaryPulse: boolean;
  isSatisfied: boolean;
  isLocked: boolean;
  isFlowHighlighted: boolean;
  isDimmed: boolean;
};

export type GalaxyInspectorSelection<TPayload> = {
  selectedNodeId: string | null;
  selectedNode: SpatialGraphNode<TPayload> | null;
  unlocks: SpatialGraphEdge[];
  dependencies: SpatialGraphEdge[];
  dependencySources: Set<string>;
};
