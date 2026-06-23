export type AtlasNodeState = 'inactive' | 'active' | 'completed' | 'blocked';

export type AtlasNodeId =
  | 'center'
  | 'registration'
  | 'housing'
  | 'healthcare'
  | 'finance'
  | 'work'
  | 'community';

export type AtlasNodeDefinition = {
  id: AtlasNodeId;
  label: string;
  x: number;
  y: number;
  isCenter?: boolean;
};

export type AtlasConnectionDefinition = {
  from: AtlasNodeId;
  to: AtlasNodeId;
};

export type JourneyStageId = 'arrival' | 'setup' | 'stabilize' | 'build';

export type AtlasSlideDefinition = {
  id: string;
  index: number;
  label: string;
  headline: string;
  headlineAccent?: string;
  supporting: string;
  cta: string;
  ctaHref: string;
  focusNode: AtlasNodeId | null;
  emphasizedConnections: Array<[AtlasNodeId, AtlasNodeId]>;
  completedNodes: AtlasNodeId[];
  blockedNodes: AtlasNodeId[];
  journeyStage: JourneyStageId;
  sidePanel: {
    title: string;
    status?: string;
    remaining: string[];
    nextStep?: string;
    tone: 'overview' | 'progress' | 'future';
  };
  mapZoom?: number;
};
