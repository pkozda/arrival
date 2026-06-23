import { readStarMapFocusedNodeId } from './arrival-routes';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import { isInternalAppPath } from '@/lib/atlas-runtime/spatial-navigation';

/** Legacy click capture — warns on raw Link usage and records fallback spatial intent. */
export function captureArrivalIntentFromClick(event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const anchor = target.closest('a[href]');
  if (!anchor) {
    return false;
  }

  const href = anchor.getAttribute('href');
  if (!href || !isInternalAppPath(href)) {
    return false;
  }

  const departedFromPath = window.location.pathname;
  const destinationPath = new URL(href, window.location.origin).pathname;

  if (destinationPath === departedFromPath) {
    return false;
  }

  if (!anchor.hasAttribute('data-atlas-nav')) {
    spatialNavigationInterceptor.warnRawLinkBypass(href);
    spatialNavigationInterceptor.markRouterFallbackNavigation();
  }

  const focusedNodeId = departedFromPath === '/' ? readStarMapFocusedNodeId() : null;
  return spatialNavigationInterceptor.ensureSpatialIntent(departedFromPath, destinationPath, {
    focusedNodeId,
    origin: anchor.hasAttribute('data-atlas-nav') ? 'atlas-link' : 'unknown',
  });
}
