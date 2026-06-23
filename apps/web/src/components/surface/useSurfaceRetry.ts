'use client';

import { useCallback, useState } from 'react';

/** UX-RETRY-* — per-surface retry in-flight state only; each surface wires its own refetch. */
export function useSurfaceRetry(refetch: () => Promise<void>) {
  const [retrying, setRetrying] = useState(false);

  const onRetry = useCallback(async () => {
    if (retrying) {
      return;
    }

    setRetrying(true);
    try {
      await refetch();
    } finally {
      setRetrying(false);
    }
  }, [refetch, retrying]);

  return { retrying, onRetry };
}
