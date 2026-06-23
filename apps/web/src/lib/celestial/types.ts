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

export type ArrivalContext = {
  sourceNodeId: CelestialNodeId;
  destinationPath: string;
  transitionType: ArrivalTransitionType;
  intensity: ArrivalIntensity;
  entryAnimationState: ArrivalEntryAnimationState;
  departedFromPath: string;
  capturedAt: number;
};

export type ArrivalContextInput = Omit<ArrivalContext, 'capturedAt' | 'entryAnimationState'> & {
  entryAnimationState?: ArrivalEntryAnimationState;
};
