import type { PlanetScaleTier } from './galaxy-dependencies';

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
  /** Dependency pull strength (0.1–1.0). Defaults to 0.5 */
  weight?: number;
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
  scaleTier: PlanetScaleTier;
  isGravitySourceActive: boolean;
  isGravityTargetPulled: boolean;
  gravityOffsetX: number;
  gravityOffsetY: number;
  gravityPullIntensity: number;
  isGuideHighlighted: boolean;
  isGuideDimmed: boolean;
  isRoutePreview: boolean;
  isDiscoveryUnlock: boolean;
  isCinematicCompletion: boolean;
  isCinematicRoute: boolean;
  isCinematicEmergence: boolean;
  isCinematicEmerging: boolean;
  isCinematicDimmed: boolean;
};

export type { PlanetScaleTier };

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
  isVisible: boolean;
  isSelectionActive: boolean;
  isSelectionInactive: boolean;
  isGravityActive: boolean;
  gravityIntensity: number;
  gravityWeight: number;
  isRoutePreview: boolean;
  isGuideDimmed: boolean;
  isCinematicTraverse: boolean;
  isCinematicTraversing: boolean;
};

export type GalaxyInspectorSelection<TPayload> = {
  selectedNodeId: string | null;
  selectedNode: SpatialGraphNode<TPayload> | null;
  unlocks: SpatialGraphEdge[];
  dependencies: SpatialGraphEdge[];
  dependencySources: Set<string>;
};
