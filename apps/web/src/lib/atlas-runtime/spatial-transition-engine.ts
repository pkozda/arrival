import type { ArrivalContext, ArrivalIntensity, ArrivalTransitionType, CelestialNodeId } from '@/lib/celestial/types';
import { getNodeOriginTransform } from '@/lib/celestial/node-origin-transforms';
import { resolveMotionPrimitive } from './motion-vocabulary';
import type { SpatialTransitionContext } from './spatial-transition-context';
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

const FAMILIAR_DURATION_SCALE = 0.72;
const FAMILIAR_MOTION_SCALE = 0.62;
const RETURN_DURATION_SCALE = 0.82;
const RETURN_MOTION_SCALE = 0.78;

function easingForPrimitive(
  primitive: SpatialMotionPrimitive,
  intensity: ArrivalIntensity,
  context?: SpatialTransitionContext
): SpatialEasingProfile {
  if (context?.isReturnTrip) {
    return 'soft-inertia';
  }

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
  intensity: ArrivalIntensity,
  motionScale = 1
): CameraMotion {
  const k = INTENSITY_CAMERA[intensity] * motionScale;

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

function resolvePrimitiveFromContext(
  arrival: ArrivalContext,
  context: SpatialTransitionContext
): SpatialMotionPrimitive {
  if (context.isReturnTrip) {
    return 'collapse-to-node';
  }

  switch (context.relation) {
    case 'same-cluster':
      return 'drift';
    case 'node-to-module':
      return 'expand-from-node';
    case 'module-to-node':
      return 'collapse-to-node';
    case 'module-to-profile':
      return context.direction === 'forward' ? 'expand-from-node' : 'drift';
    case 'profile-to-module':
      return context.direction === 'backward' ? 'collapse-to-node' : 'drift';
    case 'cross-cluster':
      return context.direction === 'forward' ? 'expand-from-node' : 'drift';
    default:
      return resolveMotionPrimitive(arrival.transitionType, arrival.sourceNodeId);
  }
}

function resolveMotionModifiers(context?: SpatialTransitionContext): {
  durationScale?: number;
  motionScale?: number;
  isReturnPath?: boolean;
} {
  if (!context) {
    return {};
  }

  if (context.isReturnTrip) {
    return {
      durationScale: RETURN_DURATION_SCALE,
      motionScale: RETURN_MOTION_SCALE,
      isReturnPath: true,
    };
  }

  if (context.memoryMatch) {
    return {
      durationScale: FAMILIAR_DURATION_SCALE,
      motionScale: FAMILIAR_MOTION_SCALE,
    };
  }

  return {};
}

export function buildSpatialTransition(
  arrival: ArrivalContext,
  context?: SpatialTransitionContext
): SpatialTransition {
  const resolvedContext = context ?? arrival.spatialTransitionContext;
  const originNodeTransform = getNodeOriginTransform(arrival.sourceNodeId);
  const motionPrimitive = resolvedContext
    ? resolvePrimitiveFromContext(arrival, resolvedContext)
    : resolveMotionPrimitive(arrival.transitionType, arrival.sourceNodeId);
  const modifiers = resolveMotionModifiers(resolvedContext);

  return {
    motionPrimitive,
    sourceNodeId: arrival.sourceNodeId,
    originNodeTransform,
    cameraMotion: buildCameraMotion(
      motionPrimitive,
      originNodeTransform,
      arrival.intensity,
      modifiers.motionScale ?? 1
    ),
    easingProfile: easingForPrimitive(motionPrimitive, arrival.intensity, resolvedContext),
    ...modifiers,
  };
}

export function buildSpatialTransitionFromRoutes(
  from: string,
  to: string,
  context: SpatialTransitionContext,
  arrival: ArrivalContext
): SpatialTransition {
  return buildSpatialTransition(
    {
      ...arrival,
      departedFromPath: from,
      destinationPath: to,
      spatialTransitionContext: context,
    },
    context
  );
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
    durationScale: 0.88,
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
  buildSpatialTransitionFromRoutes: typeof buildSpatialTransitionFromRoutes;
  buildDefaultSpatialTransition: typeof buildDefaultSpatialTransition;
  buildFallbackSpatialTransition: typeof buildFallbackSpatialTransition;
  resolveMotionPrimitive: typeof resolveMotionPrimitive;
  fallback: typeof buildFallbackSpatialTransition;
};

export const spatialTransitionEngine: SpatialTransitionEngine = {
  buildSpatialTransition,
  buildSpatialTransitionFromRoutes,
  buildDefaultSpatialTransition,
  buildFallbackSpatialTransition,
  resolveMotionPrimitive,
  fallback: buildFallbackSpatialTransition,
};
