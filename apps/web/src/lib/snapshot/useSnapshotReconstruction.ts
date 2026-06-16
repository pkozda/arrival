'use client';

import { useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { getModuleUIState } from './selectors';
import type { SnapshotReconstruction } from './types';

export function useSnapshotReconstruction(moduleId: string): SnapshotReconstruction {
  const { uiSnapshot, uiSnapshotLoading } = useApp();

  return useMemo(() => {
    const uiState = getModuleUIState(uiSnapshot, moduleId);

    return {
      ...uiState,
      isStale: uiSnapshotLoading && uiSnapshot !== null,
    };
  }, [moduleId, uiSnapshot, uiSnapshotLoading]);
}

export const useModuleSnapshot = useSnapshotReconstruction;
