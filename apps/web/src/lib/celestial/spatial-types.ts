import type { CelestialNodeId } from './types';

/** @deprecated Use SpatialMotionPrimitive from @/lib/atlas-runtime */
export type SpatialTransitionType = 'zoom-through' | 'drift' | 'orbit-focus' | 'depth-fade';

export type {
  SpatialMotionPrimitive,
  SpatialEasingProfile,
  SpatialPhase,
  SpatialParallaxOffset,
  OriginNodeTransform,
  CameraMotion,
  SpatialTransition,
} from '@/lib/atlas-runtime/types';

export { mapLegacySpatialTypeToPrimitive } from '@/lib/atlas-runtime/motion-vocabulary';
