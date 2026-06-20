'use client';

import { useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { selectUserContextProfile } from '@/lib/user-context';
import { getModuleUIState } from './selectors';
import type { SnapshotReconstruction } from './types';

export function useSnapshotReconstruction(moduleId: string): SnapshotReconstruction {
  const { uiSnapshot, uiSnapshotLoading, userContext } = useApp();
  const userProfile = selectUserContextProfile(userContext);

  return useMemo(() => {
    const uiState = getModuleUIState(
      uiSnapshot,
      moduleId,
      userProfile != null
    );

    return {
      ...uiState,
      isStale: uiSnapshotLoading && uiSnapshot !== null,
    };
  }, [moduleId, uiSnapshot, uiSnapshotLoading, userProfile]);
}

export const useModuleSnapshot = useSnapshotReconstruction;
