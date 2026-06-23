import type { CelestialNodeId } from './types';

export type SpatialTransitionType = 'zoom-through' | 'drift' | 'orbit-focus' | 'depth-fade';

export type SpatialEasingProfile = 'soft-inertia' | 'elastic-drift' | 'linear-glide';

export type SpatialPhase = 'idle' | 'exiting' | 'entering' | 'landed';

export type OriginNodeTransform = {
  x: number;
  y: number;
  scale: number;
  blur: number;
  glow: number;
};

export type CameraMotion = {
  zoomDelta: number;
  panVector: { x: number; y: number };
  rotationZ: number;
};

export type SpatialTransition = {
  type: SpatialTransitionType;
  sourceNodeId: CelestialNodeId;
  originNodeTransform: OriginNodeTransform;
  cameraMotion: CameraMotion;
  easingProfile: SpatialEasingProfile;
};

export type SpatialParallaxOffset = {
  foreground: { x: number; y: number };
  midground: { x: number; y: number };
  background: { x: number; y: number };
};
