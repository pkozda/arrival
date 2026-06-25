import type { SpatialNavigationOrigin } from '@/lib/celestial/types';
import { resolveNodeForPath } from '@/lib/celestial/arrival-routes';
import type { CelestialNodeId } from '@/lib/celestial/types';
import type { SpatialMemoryStore } from './spatial-memory-store';
import { SPATIAL_GRAPH } from './spatial-graph';

export type SpatialTransitionDirection = 'forward' | 'backward' | 'lateral';

export type SpatialTransitionRelation =
  | 'same-cluster'
  | 'cross-cluster'
  | 'node-to-module'
  | 'module-to-node'
  | 'module-to-profile'
  | 'profile-to-module';

export type SpatialTransitionContext = {
  direction: SpatialTransitionDirection;
  depthChange: number;
  relation: SpatialTransitionRelation;
  memoryMatch: boolean;
  isReturnTrip: boolean;
};

type DomainType = 'map' | 'module' | 'profile' | 'other';

function resolveDomainType(path: string): DomainType {
  if (path === '/') {
    return 'map';
  }
  if (path.startsWith('/profile')) {
    return 'profile';
  }
  if (path.startsWith('/modules')) {
    return 'module';
  }
  return 'other';
}

function domainDepth(path: string): number {
  if (path === '/') {
    return 0;
  }
  if (path === '/profile' || path.match(/^\/modules\/[^/]+$/)) {
    return 1;
  }
  return 2;
}

function resolveCluster(path: string): CelestialNodeId {
  return SPATIAL_GRAPH.resolveNodeForPath(path);
}

function resolveRelation(from: string, to: string): SpatialTransitionRelation {
  const fromDomain = resolveDomainType(from);
  const toDomain = resolveDomainType(to);

  if (fromDomain === 'map' && toDomain === 'module') {
    return 'node-to-module';
  }
  if (fromDomain === 'module' && toDomain === 'map') {
    return 'module-to-node';
  }
  if (fromDomain === 'module' && toDomain === 'profile') {
    return 'module-to-profile';
  }
  if (fromDomain === 'profile' && toDomain === 'module') {
    return 'profile-to-module';
  }

  const fromCluster = resolveCluster(from);
  const toCluster = resolveCluster(to);

  if (fromCluster !== 'center' && fromCluster === toCluster) {
    return 'same-cluster';
  }

  return 'cross-cluster';
}

function resolveDirection(
  from: string,
  to: string,
  memory: SpatialMemoryStore,
  navigationOrigin?: SpatialNavigationOrigin
): SpatialTransitionDirection {
  if (navigationOrigin === 'back-forward') {
    return 'backward';
  }

  if (memory.isReturnTo(to) || memory.wasVisitedBefore(to)) {
    return 'backward';
  }

  const depthDelta = domainDepth(to) - domainDepth(from);
  if (depthDelta > 0) {
    return 'forward';
  }
  if (depthDelta < 0) {
    return 'backward';
  }

  return 'lateral';
}

export function getSpatialTransitionContext(
  from: string,
  to: string,
  memory: SpatialMemoryStore,
  navigationOrigin?: SpatialNavigationOrigin
): SpatialTransitionContext {
  const direction = resolveDirection(from, to, memory, navigationOrigin);
  const depthChange = domainDepth(to) - domainDepth(from);
  const relation = resolveRelation(from, to);
  const memoryMatch = memory.hasTransitionPattern(from, to) || memory.hasVisitedRoute(to);
  const isReturnTrip = memory.isReturnTo(to) || (direction === 'backward' && memory.hasVisitedRoute(to));

  return {
    direction,
    depthChange,
    relation,
    memoryMatch,
    isReturnTrip,
  };
}

export function resolveSourceNodeForTransition(from: string, to: string): CelestialNodeId {
  if (from === '/') {
    return resolveNodeForPath(to);
  }

  return resolveCluster(from);
}
