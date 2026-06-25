import type { CelestialNodeId } from '@/lib/celestial/types';
import type { SpatialGraph } from './spatial-graph';
import type { AtlasCosmicTheme } from './theme';
import type { SpatialTransitionEngine } from './spatial-transition-engine';

/** Canonical motion vocabulary — all transitions map to one of these primitives. */
export type SpatialMotionPrimitive =
  | 'drift'
  | 'focus-in'
  | 'collapse-to-node'
  | 'expand-from-node'
  | 'ambient-shift';

export type AtlasShellMode = 'star-map' | 'destination';

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

export type SpatialEasingProfile = 'soft-inertia' | 'elastic-drift' | 'linear-glide';

export type SpatialPhase = 'idle' | 'exiting' | 'entering' | 'landed';

export type SpatialParallaxOffset = {
  foreground: { x: number; y: number };
  midground: { x: number; y: number };
  background: { x: number; y: number };
};

export type SpatialTransition = {
  motionPrimitive: SpatialMotionPrimitive;
  sourceNodeId: CelestialNodeId;
  originNodeTransform: OriginNodeTransform;
  cameraMotion: CameraMotion;
  easingProfile: SpatialEasingProfile;
  /** Multiplier for enter/exit duration — lower feels faster/familiar. */
  durationScale?: number;
  /** Scales camera motion intensity. */
  motionScale?: number;
  /** A → B → A return path — reversed collapse easing. */
  isReturnPath?: boolean;
};

/**
 * Single UI authority — theme, motion, shell, canvas, and navigation graph.
 */
export type AtlasAppRuntime = {
  theme: AtlasCosmicTheme;
  motionEngine: SpatialTransitionEngine;
  shellMode: AtlasShellMode;
  navigationModel: SpatialGraph;
};
