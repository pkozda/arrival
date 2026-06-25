import type { GalaxyNodeState, SpatialGraphEdge, SpatialGraphNode } from '@/lib/presentation/spatial-core';

export type JourneyGuideMode = 'guided' | 'independent';

export type AssistanceStage = 1 | 2 | 3 | 4;

export type JourneyGuidePersistedState = {
  version: 1;
  hasChosenMode: boolean;
  mode: JourneyGuideMode;
  assistanceStage: AssistanceStage;
  completedMissionIds: string[];
  lockedClickCount: number;
  lastActiveAt: string | null;
  dismissedWelcomeSurfaces: string[];
};

export type PlanetRecommendation = {
  nodeId: string;
  title: string;
  missionTitle: string;
  reason: string;
  unlockPreview: Array<{ nodeId: string; title: string; missionTitle: string }>;
};

export type JourneyGuideGraphSnapshot = {
  surfaceId: string;
  graphNodes: SpatialGraphNode[];
  graphEdges: SpatialGraphEdge[];
  lockedNodeIds: Set<string>;
  selectedNodeId: string | null;
  nodeTitles: Record<string, string>;
};

export type RoutePreviewState = {
  nodeIds: string[];
  edgeIds: string[];
  startedAt: number;
};

export type DiscoveryState = {
  nodeIds: string[];
  titles: string[];
  startedAt: number;
};

export type LockedGuideState = {
  nodeId: string;
  title: string;
  prerequisiteIds: string[];
  prerequisiteTitles: string[];
};

export type JourneyGuideProbeState = 'idle' | 'moving' | 'speaking' | 'highlighting';

export type GuideNodeMeta = {
  id: string;
  title: string;
  missionTitle: string;
  status: GalaxyNodeState;
  isLocked: boolean;
};
