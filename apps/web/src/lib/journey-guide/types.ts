import type { ConfidencePresentation } from '@/lib/certainty/formatters';
import type { CertaintyState } from '@/lib/certainty/types';
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
  lastUnlockEvent: StoredUnlockEvent | null;
};

export type GuideTone = 'calm' | 'attentive' | 'blocked' | 'exploratory';

export type PlanetRecommendation = {
  nodeId: string;
  title: string;
  missionTitle: string;
  reason: string;
  unlockPreview: Array<{ nodeId: string; title: string; missionTitle: string }>;
};

export type JourneyGuideViewModel = {
  nodeId: string;
  currentMission: string;
  recommendedStep: string;
  explanation: string;
  outcome?: string;
  tone: GuideTone;
  confidencePresentation: ConfidencePresentation;
  progress?: {
    completed: number;
    total: number;
    label: string;
  };
  unlockPreview: PlanetRecommendation['unlockPreview'];
};

export type JourneyGuideCertaintySource = {
  state: CertaintyState;
  recommendedNodeId: string;
  unlockPreview: Array<{ nodeId: string; title: string }>;
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

export type CinematicUnlockPhase =
  | 'completion'
  | 'routes'
  | 'emergence'
  | 'overlay'
  | 'guide';

export type CinematicUnlockRouteStep = {
  edgeId: string;
  toNodeId: string;
};

export type CinematicUnlockSequence = {
  sourceNodeId: string;
  sourceTitle: string;
  sourceMissionTitle: string;
  newlyUnlockedNodeIds: string[];
  newlyUnlockedTitles: string[];
  routeSteps: CinematicUnlockRouteStep[];
  chainNodeIds: string[];
  chainEdgeIds: string[];
};

export type StoredUnlockEvent = {
  surfaceId: string;
  sourceNodeId: string;
  sourceTitle: string;
  newlyUnlockedNodeIds: string[];
  newlyUnlockedTitles: string[];
  chainNodeIds: string[];
  chainEdgeIds: string[];
  routeSteps: CinematicUnlockRouteStep[];
  recordedAt: string;
};

export type CinematicUnlockState = CinematicUnlockSequence & {
  phase: CinematicUnlockPhase;
  routeProgress: number;
  emergenceProgress: number;
  phaseStartedAt: number;
  startedAt: number;
  isReplay: boolean;
  guideTitle: string;
  guideBody: string;
  overlayTitle: string;
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
