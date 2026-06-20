import type { UiSnapshot } from '@/lib/product-contract';
import type { ModuleUIProjection } from '@/lib/product-contract';
import type { ModuleUIState, ModuleUIStatus } from '../types';
import { getModuleExecution } from './get-module-execution';

function resolveStatus(
  snapshot: UiSnapshot | null,
  hasProjection: boolean,
  hasUserProfile: boolean
): ModuleUIStatus {
  if (hasProjection) {
    return 'executed';
  }

  if (hasUserProfile) {
    return 'partial';
  }

  return 'idle';
}

export function getModuleUIState(
  snapshot: UiSnapshot | null,
  moduleId: string,
  hasUserProfile = false
): ModuleUIState {
  const execution = getModuleExecution(snapshot, moduleId);
  const projection = (execution?.projection as ModuleUIProjection | undefined) ?? null;

  return {
    projection,
    status: resolveStatus(snapshot, projection != null, hasUserProfile),
    executionId: execution?.executionId ?? null,
    snapshotVersion: snapshot?.snapshotVersion ?? 0,
  };
}
