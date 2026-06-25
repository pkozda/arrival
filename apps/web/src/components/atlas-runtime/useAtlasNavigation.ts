'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { buildArrivalContext } from '@/lib/celestial/arrival-routes';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import { spatialMemoryStore } from '@/lib/atlas-runtime/spatial-memory-store';
import { getSpatialTransitionContext } from '@/lib/atlas-runtime/spatial-transition-context';
import { normalizeNavigationPath } from '@/lib/atlas-runtime/spatial-navigation';
import { useArrival } from '@/components/celestial/ArrivalProvider';
import { useAtlasRuntime } from './AtlasRuntimeProvider';

type NavigateOptions = {
  replace?: boolean;
};

/**
 * Canonical Atlas navigation — records spatial arrival intent and routes through
 * SpatialTransitionEngine (via ArrivalProvider on destination mount).
 */
export function useAtlasNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { motionEngine } = useAtlasRuntime();
  const { recordArrivalIntent, spatialPhase } = useArrival();

  const navigate = useCallback(
    (href: string, options?: NavigateOptions) => {
      const departedFromPath = pathname ?? '/';
      const destinationPath = normalizeNavigationPath(href);

      if (destinationPath === departedFromPath) {
        return;
      }

      if (!spatialNavigationInterceptor.isRuntimeNavigationMarked()) {
        spatialNavigationInterceptor.markExplicitNavigation();
      }

      const arrival = buildArrivalContext(departedFromPath, destinationPath);
      const spatialTransitionContext = getSpatialTransitionContext(
        departedFromPath,
        destinationPath,
        spatialMemoryStore,
        'explicit'
      );
      motionEngine.buildSpatialTransition(
        { ...arrival, spatialTransitionContext },
        spatialTransitionContext
      );
      recordArrivalIntent(destinationPath);

      if (options?.replace) {
        router.replace(href);
        return;
      }

      router.push(href);
    },
    [motionEngine, pathname, recordArrivalIntent, router]
  );

  const guardedRouter = useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        navigate(href);
        return;
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        navigate(href, { replace: true });
        return;
      },
    }),
    [navigate, router]
  );

  return {
    navigate,
    arriveAt: navigate,
    push: navigate,
    router: guardedRouter,
    spatialPhase,
  };
}
