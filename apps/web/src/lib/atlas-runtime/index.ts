export type {
  AtlasAppRuntime,
  AtlasShellMode,
  CameraMotion,
  OriginNodeTransform,
  SpatialEasingProfile,
  SpatialMotionPrimitive,
  SpatialParallaxOffset,
  SpatialPhase,
  SpatialTransition,
} from './types';

export { ATLAS_COSMIC_THEME } from './theme';
export type { AtlasCosmicTheme } from './theme';

export { SPATIAL_GRAPH } from './spatial-graph';
export type { SpatialGraph, SpatialGraphNode } from './spatial-graph';

export {
  ambientShiftPrimitive,
  mapLegacySpatialTypeToPrimitive,
  MOTION_PRIMITIVE_LABELS,
  resolveMotionPrimitive,
} from './motion-vocabulary';

export {
  buildDefaultSpatialTransition,
  buildSpatialTransition,
  buildFallbackSpatialTransition,
  resolveSpatialTransitionType,
  spatialTransitionEngine,
} from './spatial-transition-engine';
export type { SpatialTransitionEngine } from './spatial-transition-engine';

export { buildSpatialVariants } from './spatial-motion';

export {
  installSpatialRouteInterceptor,
  isInternalAppPath,
  normalizeNavigationPath,
  recordSpatialNavigation,
} from './spatial-navigation';

export { spatialNavigationInterceptor } from './spatial-navigation-interceptor';
export type { SpatialNavigationInterceptOptions } from './spatial-navigation-interceptor';
