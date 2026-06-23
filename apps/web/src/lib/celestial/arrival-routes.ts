import type {
  ArrivalContextInput,
  ArrivalIntensity,
  ArrivalTransitionType,
  CelestialNodeId,
  SpatialNavigationOrigin,
} from './types';
import { isCelestialNodeId } from './node-labels';

const ROUTE_NODE_DEFAULTS: Array<{ match: (path: string) => boolean; nodeId: CelestialNodeId }> = [
  { match: (path) => path === '/profile' || path.startsWith('/profile/'), nodeId: 'housing' },
  { match: (path) => path.startsWith('/modules/life-event'), nodeId: 'registration' },
  { match: (path) => path.startsWith('/modules/economic-reality'), nodeId: 'finance' },
  { match: (path) => path.startsWith('/modules/'), nodeId: 'work' },
];

const NODE_TRANSITION: Record<CelestialNodeId, ArrivalTransitionType> = {
  center: 'fade-through-space',
  registration: 'warp',
  housing: 'fade-through-space',
  healthcare: 'zoom-collapse',
  finance: 'zoom-collapse',
  work: 'warp',
  community: 'fade-through-space',
};

const NODE_INTENSITY: Record<CelestialNodeId, ArrivalIntensity> = {
  center: 'low',
  registration: 'high',
  housing: 'medium',
  healthcare: 'medium',
  finance: 'high',
  work: 'high',
  community: 'medium',
};

export function resolveNodeForPath(pathname: string): CelestialNodeId {
  const hit = ROUTE_NODE_DEFAULTS.find((entry) => entry.match(pathname));
  return hit?.nodeId ?? 'center';
}

export function readStarMapFocusedNodeId(): CelestialNodeId | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const focused = document.querySelector('.atlas-node--focused')?.getAttribute('data-node-id');
  return isCelestialNodeId(focused) ? focused : null;
}

function intensityForNavigation(
  departedFromPath: string,
  destinationPath: string,
  sourceNodeId: CelestialNodeId
): ArrivalIntensity {
  if (departedFromPath === '/' && destinationPath !== '/') {
    return NODE_INTENSITY[sourceNodeId];
  }

  if (departedFromPath !== destinationPath) {
    return 'low';
  }

  return 'low';
}

function transitionForNavigation(
  departedFromPath: string,
  destinationPath: string,
  sourceNodeId: CelestialNodeId
): ArrivalTransitionType {
  if (departedFromPath === '/') {
    return NODE_TRANSITION[sourceNodeId];
  }

  if (departedFromPath.startsWith('/profile') && destinationPath.startsWith('/profile')) {
    return 'fade-through-space';
  }

  if (departedFromPath.startsWith('/modules') && destinationPath.startsWith('/modules')) {
    return 'zoom-collapse';
  }

  return 'fade-through-space';
}

export function buildArrivalContext(
  departedFromPath: string,
  destinationPath: string,
  focusedNodeId?: CelestialNodeId | null
): ArrivalContextInput {
  const sourceNodeId =
    departedFromPath === '/' && focusedNodeId
      ? focusedNodeId
      : resolveNodeForPath(departedFromPath);

  return {
    sourceNodeId,
    destinationPath,
    departedFromPath,
    transitionType: transitionForNavigation(departedFromPath, destinationPath, sourceNodeId),
    intensity: intensityForNavigation(departedFromPath, destinationPath, sourceNodeId),
    navigationOrigin: 'explicit',
    navigationMode: 'explicit-spatial',
  };
}

/** Default drift transition when spatial origin cannot be resolved. */
export function buildFallbackArrivalContext(
  departedFromPath: string,
  destinationPath: string,
  navigationOrigin: SpatialNavigationOrigin = 'unknown'
): ArrivalContextInput {
  return {
    sourceNodeId: 'center',
    destinationPath,
    departedFromPath,
    transitionType: 'fade-through-space',
    intensity: 'low',
    navigationOrigin,
    navigationMode: 'fallback-spatial',
  };
}
