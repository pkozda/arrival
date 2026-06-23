import type { ArrivalContext, ArrivalIntensity, ArrivalTransitionType, CelestialNodeId } from './types';
import { getNodeOriginTransform } from './node-origin-transforms';
import type {
  CameraMotion,
  SpatialEasingProfile,
  SpatialTransition,
  SpatialTransitionType,
} from './spatial-types';

const LEGACY_TO_SPATIAL: Record<ArrivalTransitionType, SpatialTransitionType> = {
  warp: 'zoom-through',
  'fade-through-space': 'drift',
  'zoom-collapse': 'depth-fade',
};

const NODE_SPATIAL_OVERRIDE: Partial<Record<CelestialNodeId, SpatialTransitionType>> = {
  healthcare: 'orbit-focus',
  community: 'orbit-focus',
  work: 'zoom-through',
};

const INTENSITY_CAMERA: Record<ArrivalIntensity, number> = {
  low: 0.75,
  medium: 1,
  high: 1.22,
};

function easingForType(type: SpatialTransitionType, intensity: ArrivalIntensity): SpatialEasingProfile {
  if (type === 'drift') {
    return 'elastic-drift';
  }
  if (type === 'orbit-focus' && intensity !== 'low') {
    return 'soft-inertia';
  }
  return intensity === 'low' ? 'linear-glide' : 'soft-inertia';
}

function buildCameraMotion(
  type: SpatialTransitionType,
  origin: ReturnType<typeof getNodeOriginTransform>,
  intensity: ArrivalIntensity
): CameraMotion {
  const k = INTENSITY_CAMERA[intensity];

  switch (type) {
    case 'zoom-through':
      return {
        zoomDelta: 0.14 * k,
        panVector: { x: origin.x * -90 * k, y: origin.y * -64 * k },
        rotationZ: 0.35 * Math.sign(origin.x) * k,
      };
    case 'orbit-focus':
      return {
        zoomDelta: 0.09 * k,
        panVector: { x: origin.x * -72 * k, y: origin.y * -52 * k },
        rotationZ: 1.8 * Math.sign(origin.x || 1) * k,
      };
    case 'depth-fade':
      return {
        zoomDelta: -0.07 * k,
        panVector: { x: origin.x * -48 * k, y: origin.y * -38 * k },
        rotationZ: 0.2 * Math.sign(origin.y) * k,
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

export function resolveSpatialTransitionType(
  legacyType: ArrivalTransitionType,
  sourceNodeId: CelestialNodeId
): SpatialTransitionType {
  return NODE_SPATIAL_OVERRIDE[sourceNodeId] ?? LEGACY_TO_SPATIAL[legacyType];
}

export function buildSpatialTransition(arrival: ArrivalContext): SpatialTransition {
  const originNodeTransform = getNodeOriginTransform(arrival.sourceNodeId);
  const type = resolveSpatialTransitionType(arrival.transitionType, arrival.sourceNodeId);

  return {
    type,
    sourceNodeId: arrival.sourceNodeId,
    originNodeTransform,
    cameraMotion: buildCameraMotion(type, originNodeTransform, arrival.intensity),
    easingProfile: easingForType(type, arrival.intensity),
  };
}

export function buildDefaultSpatialTransition(
  sourceNodeId: CelestialNodeId = 'center'
): SpatialTransition {
  const originNodeTransform = getNodeOriginTransform(sourceNodeId);
  return {
    type: 'drift',
    sourceNodeId,
    originNodeTransform,
    cameraMotion: buildCameraMotion('drift', originNodeTransform, 'low'),
    easingProfile: 'linear-glide',
  };
}
