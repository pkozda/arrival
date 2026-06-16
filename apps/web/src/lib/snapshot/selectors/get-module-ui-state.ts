import type { UiSnapshot } from '@/lib/api';
import type { ModuleUIState, ModuleUIStatus } from '../types';
import { getModuleExecution } from './get-module-execution';
import { getModuleInputDefaults } from './get-module-input-defaults';
import { getModuleUx } from './get-module-ux';

function hasPartialProfile(snapshot: UiSnapshot | null, moduleId: string): boolean {
  const profile = snapshot?.profile;
  if (!profile) {
    return false;
  }

  switch (moduleId) {
    case 'financial-reality':
      return Boolean(
        profile.employment?.grossMonthlyIncome
        || profile.employment?.status
        || profile.household?.size
        || profile.household?.maritalStatus
        || profile.housing?.monthlyColdRent
      );
    case 'healthcare-navigation':
      return Boolean(
        profile.insurance?.type
        || profile.insurance?.hasCoverage !== undefined
      );
    case 'grocery-optimization':
      return Boolean(profile.household?.size);
    default:
      return false;
  }
}

function resolveStatus(
  snapshot: UiSnapshot | null,
  moduleId: string,
  hasResult: boolean
): ModuleUIStatus {
  if (hasResult) {
    return 'executed';
  }

  if (hasPartialProfile(snapshot, moduleId)) {
    return 'partial';
  }

  return 'idle';
}

export function getModuleUIState(
  snapshot: UiSnapshot | null,
  moduleId: string
): ModuleUIState {
  const execution = getModuleExecution(snapshot, moduleId);
  const result = execution?.result ?? null;

  return {
    input: getModuleInputDefaults(snapshot, moduleId),
    result,
    ux: getModuleUx(snapshot, moduleId),
    status: resolveStatus(snapshot, moduleId, result != null),
    executionId: execution?.executionId ?? null,
    snapshotVersion: snapshot?.snapshotVersion ?? 0,
  };
}
