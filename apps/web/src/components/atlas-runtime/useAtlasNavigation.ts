'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import { normalizeNavigationPath } from '@/lib/atlas-runtime/spatial-navigation';
import { useArrival } from '@/components/celestial/ArrivalProvider';

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

      recordArrivalIntent(destinationPath);

      if (options?.replace) {
        router.replace(href);
        return;
      }

      router.push(href);
    },
    [pathname, recordArrivalIntent, router]
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
