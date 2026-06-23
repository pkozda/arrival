import { buildArrivalContext, readStarMapFocusedNodeId } from './arrival-routes';
import { persistArrivalIntent } from './arrival-storage';

function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

function normalizePath(href: string): string {
  const url = new URL(href, window.location.origin);
  return url.pathname;
}

/** Observes departures from star-map and destination pages without modifying homepage code. */
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
  if (!href || !isInternalHref(href)) {
    return false;
  }

  const departedFromPath = window.location.pathname;
  const destinationPath = normalizePath(href);

  if (destinationPath === departedFromPath) {
    return false;
  }

  const focusedNodeId = departedFromPath === '/' ? readStarMapFocusedNodeId() : null;

  persistArrivalIntent(buildArrivalContext(departedFromPath, destinationPath, focusedNodeId));
  return true;
}
