import type { ArrivalContext, ArrivalIntensity, ArrivalTransitionType, CelestialNodeId } from '@/lib/celestial/types';
import { getNodeOriginTransform } from '@/lib/celestial/node-origin-transforms';
import { resolveMotionPrimitive } from './motion-vocabulary';
import type {
  CameraMotion,
  SpatialEasingProfile,
  SpatialMotionPrimitive,
  SpatialTransition,
} from './types';

const INTENSITY_CAMERA: Record<ArrivalIntensity, number> = {
  low: 0.75,
  medium: 1,
  high: 1.22,
};

function easingForPrimitive(
  primitive: SpatialMotionPrimitive,
  intensity: ArrivalIntensity
): SpatialEasingProfile {
  if (primitive === 'drift' || primitive === 'ambient-shift') {
    return 'elastic-drift';
  }
  if (primitive === 'focus-in' && intensity !== 'low') {
    return 'soft-inertia';
  }
  if (primitive === 'collapse-to-node') {
    return intensity === 'low' ? 'linear-glide' : 'soft-inertia';
  }
  return intensity === 'low' ? 'linear-glide' : 'soft-inertia';
}

function buildCameraMotion(
  primitive: SpatialMotionPrimitive,
  origin: ReturnType<typeof getNodeOriginTransform>,
  intensity: ArrivalIntensity
): CameraMotion {
  const k = INTENSITY_CAMERA[intensity];

  switch (primitive) {
    case 'expand-from-node':
      return {
        zoomDelta: 0.14 * k,
        panVector: { x: origin.x * -90 * k, y: origin.y * -64 * k },
        rotationZ: 0.35 * Math.sign(origin.x) * k,
      };
    case 'focus-in':
      return {
        zoomDelta: 0.09 * k,
        panVector: { x: origin.x * -72 * k, y: origin.y * -52 * k },
        rotationZ: 1.8 * Math.sign(origin.x || 1) * k,
      };
    case 'collapse-to-node':
      return {
        zoomDelta: -0.07 * k,
        panVector: { x: origin.x * -48 * k, y: origin.y * -38 * k },
        rotationZ: 0.2 * Math.sign(origin.y) * k,
      };
    case 'ambient-shift':
      return {
        zoomDelta: 0.03 * k,
        panVector: { x: origin.x * -40 * k, y: origin.y * -28 * k },
        rotationZ: 0.15 * Math.sign(origin.x) * k,
      };
    case 'drift':
    default:
      return {
        zoomDelta: 0.05 * k,
        panVector: { x: origin.x * -110 * k, y: origin.y * -78 * k },
        rotationZ: 0.55 * Math.sign(origin.x) * k,
      };
  }
}

export function buildSpatialTransition(arrival: ArrivalContext): SpatialTransition {
  const originNodeTransform = getNodeOriginTransform(arrival.sourceNodeId);
  const motionPrimitive = resolveMotionPrimitive(arrival.transitionType, arrival.sourceNodeId);

  return {
    motionPrimitive,
    sourceNodeId: arrival.sourceNodeId,
    originNodeTransform,
    cameraMotion: buildCameraMotion(motionPrimitive, originNodeTransform, arrival.intensity),
    easingProfile: easingForPrimitive(motionPrimitive, arrival.intensity),
  };
}

export function buildDefaultSpatialTransition(
  sourceNodeId: CelestialNodeId = 'center'
): SpatialTransition {
  return buildFallbackSpatialTransition(sourceNodeId);
}

/** Drift fallback when navigation origin is unknown or intercepted. */
export function buildFallbackSpatialTransition(
  sourceNodeId: CelestialNodeId = 'center'
): SpatialTransition {
  const originNodeTransform = getNodeOriginTransform(sourceNodeId);
  return {
    motionPrimitive: 'drift',
    sourceNodeId,
    originNodeTransform,
    cameraMotion: buildCameraMotion('drift', originNodeTransform, 'low'),
    easingProfile: 'linear-glide',
  };
}

/** @deprecated Use resolveMotionPrimitive */
export function resolveSpatialTransitionType(
  legacyType: ArrivalTransitionType,
  sourceNodeId: CelestialNodeId
): SpatialMotionPrimitive {
  return resolveMotionPrimitive(legacyType, sourceNodeId);
}

export type SpatialTransitionEngine = {
  buildSpatialTransition: typeof buildSpatialTransition;
  buildDefaultSpatialTransition: typeof buildDefaultSpatialTransition;
  buildFallbackSpatialTransition: typeof buildFallbackSpatialTransition;
  resolveMotionPrimitive: typeof resolveMotionPrimitive;
  fallback: typeof buildFallbackSpatialTransition;
};

export const spatialTransitionEngine: SpatialTransitionEngine = {
  buildSpatialTransition,
  buildDefaultSpatialTransition,
  buildFallbackSpatialTransition,
  resolveMotionPrimitive,
  fallback: buildFallbackSpatialTransition,
};
