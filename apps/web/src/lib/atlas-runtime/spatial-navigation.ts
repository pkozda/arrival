import type { CelestialNodeId } from '@/lib/celestial/types';
import { spatialNavigationInterceptor } from './spatial-navigation-interceptor';

export function normalizeNavigationPath(href: string): string {
  if (typeof window === 'undefined') {
    return href.split('?')[0]?.split('#')[0] ?? href;
  }

  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href.split('?')[0]?.split('#')[0] ?? href;
  }
}

export function isInternalAppPath(href: string): boolean {
  const path = href.split('?')[0]?.split('#')[0] ?? href;
  return path.startsWith('/') && !path.startsWith('//');
}

export function recordSpatialNavigation(
  departedFromPath: string,
  destinationPath: string,
  options?: { focusedNodeId?: CelestialNodeId | null }
): void {
  spatialNavigationInterceptor.ensureSpatialIntent(departedFromPath, destinationPath, {
    focusedNodeId: options?.focusedNodeId,
    origin: 'explicit',
  });
}

/** @deprecated Use spatialNavigationInterceptor.install */
export function installSpatialRouteInterceptor(
  options: Parameters<typeof spatialNavigationInterceptor.install>[0]
): () => void {
  return spatialNavigationInterceptor.install(options);
}
