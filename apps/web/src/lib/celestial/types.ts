export type CelestialNodeId =
  | 'center'
  | 'registration'
  | 'housing'
  | 'healthcare'
  | 'finance'
  | 'work'
  | 'community';

export type ArrivalTransitionType = 'warp' | 'fade-through-space' | 'zoom-collapse';

export type ArrivalIntensity = 'low' | 'medium' | 'high';

export type ArrivalEntryAnimationState = 'pending' | 'entering' | 'arrived' | 'idle';

export type SpatialNavigationOrigin =
  | 'explicit'
  | 'atlas-link'
  | 'router-fallback'
  | 'back-forward'
  | 'unknown';

export type SpatialNavigationMode = 'explicit-spatial' | 'fallback-spatial';

export type ArrivalContext = {
  sourceNodeId: CelestialNodeId;
  destinationPath: string;
  transitionType: ArrivalTransitionType;
  intensity: ArrivalIntensity;
  entryAnimationState: ArrivalEntryAnimationState;
  departedFromPath: string;
  capturedAt: number;
  navigationOrigin?: SpatialNavigationOrigin;
  navigationMode?: SpatialNavigationMode;
};

export type ArrivalContextInput = Omit<ArrivalContext, 'capturedAt' | 'entryAnimationState'> & {
  entryAnimationState?: ArrivalEntryAnimationState;
};
