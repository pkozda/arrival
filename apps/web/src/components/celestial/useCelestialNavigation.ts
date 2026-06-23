'use client';

import { useAtlasNavigation } from '@/components/atlas-runtime/useAtlasNavigation';

/** @deprecated Use useAtlasNavigation from @/components/atlas-runtime */
export function useCelestialNavigation() {
  const { arriveAt, router } = useAtlasNavigation();
  return { arriveAt, router };
}
