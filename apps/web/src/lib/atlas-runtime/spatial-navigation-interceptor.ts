import {
  buildArrivalContext,
  buildFallbackArrivalContext,
  readStarMapFocusedNodeId,
} from '@/lib/celestial/arrival-routes';
import { peekArrivalIntent, persistArrivalIntent } from '@/lib/celestial/arrival-storage';
import type { CelestialNodeId, SpatialNavigationOrigin } from '@/lib/celestial/types';
import { isInternalAppPath, normalizeNavigationPath } from './spatial-navigation';

const ATLAS_NAV_BYPASS_WARN =
  'Atlas Navigation bypass detected — use AtlasLink or useAtlasNavigation()';

export type SpatialNavigationInterceptOptions = {
  getCurrentPath: () => string;
  onNavigationStart?: (departedFromPath: string, destinationPath: string) => void;
  onFallbackRequired?: () => void;
};

type EnsureIntentOptions = {
  focusedNodeId?: CelestialNodeId | null;
  origin?: SpatialNavigationOrigin;
};

let pendingOrigin: SpatialNavigationOrigin | null = null;
let runtimeNavigationMarked = false;

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

function warnBypass(message: string, detail?: string): void {
  if (!isDev()) {
    return;
  }

  console.warn(detail ? `${message} (${detail})` : message);
}

function resolveHistoryUrl(url: string | URL | null | undefined): string | null {
  if (url == null) {
    return null;
  }

  const href = typeof url === 'string' ? url : url.toString();
  if (!isInternalAppPath(href)) {
    return null;
  }

  return normalizeNavigationPath(href);
}

function consumePendingOrigin(fallback: SpatialNavigationOrigin): SpatialNavigationOrigin {
  const origin = pendingOrigin ?? fallback;
  pendingOrigin = null;
  return origin;
}

function shouldUseFallback(origin: SpatialNavigationOrigin): boolean {
  return origin === 'unknown' || origin === 'router-fallback' || origin === 'back-forward';
}

/**
 * Spatial Navigation Enforcement Layer (SNEL) — guarantees every route change
 * records spatial intent with explicit or fallback drift transition.
 */
export const spatialNavigationInterceptor = {
  markExplicitNavigation(): void {
    pendingOrigin = 'explicit';
    runtimeNavigationMarked = true;
  },

  markAtlasLinkNavigation(): void {
    pendingOrigin = 'atlas-link';
    runtimeNavigationMarked = true;
  },

  markRouterFallbackNavigation(): void {
    pendingOrigin = 'router-fallback';
  },

  markBackForwardNavigation(): void {
    pendingOrigin = 'back-forward';
  },

  clearRuntimeNavigationMark(): void {
    runtimeNavigationMarked = false;
  },

  isRuntimeNavigationMarked(): boolean {
    return runtimeNavigationMarked;
  },

  warnRouterBypass(): void {
    warnBypass(ATLAS_NAV_BYPASS_WARN, 'router.push/replace outside runtime layer');
  },

  warnRawLinkBypass(href: string): void {
    warnBypass(ATLAS_NAV_BYPASS_WARN, `raw <Link href="${href}" />`);
  },

  ensureSpatialIntent(
    departedFromPath: string,
    destinationPath: string,
    options: EnsureIntentOptions = {}
  ): boolean {
    if (destinationPath === departedFromPath) {
      return false;
    }

    if (peekArrivalIntent(destinationPath)) {
      runtimeNavigationMarked = false;
      return false;
    }

    const origin = consumePendingOrigin(options.origin ?? 'unknown');
    const focusedNodeId =
      options.focusedNodeId ??
      (departedFromPath === '/' ? readStarMapFocusedNodeId() : null);

    const input = shouldUseFallback(origin)
      ? buildFallbackArrivalContext(departedFromPath, destinationPath, origin)
      : {
          ...buildArrivalContext(departedFromPath, destinationPath, focusedNodeId),
          navigationOrigin: origin,
          navigationMode: 'explicit-spatial' as const,
        };

    persistArrivalIntent(input);
    runtimeNavigationMarked = false;
    return true;
  },

  install(options: SpatialNavigationInterceptOptions): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const { getCurrentPath, onNavigationStart, onFallbackRequired } = options;

    const maybeIntercept = (destinationPath: string | null, origin: SpatialNavigationOrigin) => {
      if (!destinationPath) {
        return;
      }

      const departedFromPath = getCurrentPath();
      if (destinationPath === departedFromPath) {
        return;
      }

      if (peekArrivalIntent(destinationPath)) {
        runtimeNavigationMarked = false;
        return;
      }

      if (!runtimeNavigationMarked && origin === 'router-fallback' && isDev()) {
        this.warnRouterBypass();
      }

      const created = this.ensureSpatialIntent(departedFromPath, destinationPath, { origin });
      if (created) {
        onFallbackRequired?.();
        onNavigationStart?.(departedFromPath, destinationPath);
      }
    };

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function pushState(state, title, url) {
      maybeIntercept(resolveHistoryUrl(url), 'router-fallback');
      return originalPushState(state, title, url);
    };

    history.replaceState = function replaceState(state, title, url) {
      maybeIntercept(resolveHistoryUrl(url), 'router-fallback');
      return originalReplaceState(state, title, url);
    };

    const onPopState = () => {
      this.markBackForwardNavigation();
      maybeIntercept(window.location.pathname, 'back-forward');
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', onPopState);
    };
  },
};
