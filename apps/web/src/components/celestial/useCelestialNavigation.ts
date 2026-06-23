'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useArrival } from './ArrivalProvider';

/** Semantic navigation — route change as a celestial arrival event. */
export function useCelestialNavigation() {
  const router = useRouter();
  const { recordArrivalIntent } = useArrival();

  const arriveAt = useCallback(
    (href: string) => {
      recordArrivalIntent(href);
      router.push(href);
    },
    [recordArrivalIntent, router]
  );

  return { arriveAt, router };
}
