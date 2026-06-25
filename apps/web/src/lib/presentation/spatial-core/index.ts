export type {
  GalaxyEdgeType,
  GalaxyEdgeVisualState,
  GalaxyInspectorSelection,
  GalaxyNodeState,
  GalaxyNodeVisualState,
  GalaxyOrbitRing,
  SpatialGraphEdge,
  SpatialGraphNode,
} from './types';

export {
  GALAXY_CENTER,
  GALAXY_ORBIT_RADII,
  distributeOrbitAngles,
  galaxyEdgePath,
  layoutGalaxyGraphNodes,
  type GalaxyLayoutInput,
} from './galaxy-layout';

export { useGalaxyGraphModel, type GalaxyGraphModel } from './useGalaxyGraphModel';
export { GalaxyViewport } from './GalaxyViewport';
export { GalaxyGraphStage } from './GalaxyGraphStage';
export { GalaxyNodeRenderer } from './GalaxyNodeRenderer';
export { GalaxyInspectorShell } from './GalaxyInspectorShell';
export { GalaxyProgressProvider, useGalaxyProgressContext, useGalaxyProgressState } from './GalaxyProgressProvider';
export { useGalaxyProgressReporter } from './useModuleProgressUI';
export { computeModuleProgressUI, computeNodeStarRating, type ModuleProgressUIState, type NodeStarRating } from './module-progress';
export {
  assignDependencyEdgeCurvatureOffsets,
  buildIncomingDependencyMap,
  computeLockedNodeIds,
  getUnsatisfiedDependencySources,
  isDependencyEdgeSatisfied,
  isNodeLockedByDependencies,
  isPrerequisiteSatisfied,
  JOURNEY_NODE_ID,
} from './galaxy-dependencies';
export {
  GalaxyInspectorContext,
  GalaxyInspectorEmpty,
  GalaxyInspectorItems,
  GalaxyInspectorRequires,
  GalaxyInspectorSection,
  GalaxyInspectorStatus,
  GalaxyInspectorTitle,
} from './GalaxyInspectorSections';
export { galaxyStatusLabel, toGalaxyNodeStatus, type GalaxyNodeEntityInput } from './map-galaxy-node';
