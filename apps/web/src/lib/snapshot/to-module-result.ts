import type { ModuleResult } from '@/lib/api';
import type { ModuleUIState } from './types';

export function toModuleResult<T = unknown>(
  moduleId: string,
  uiState: ModuleUIState
): ModuleResult<T> | null {
  if (uiState.result == null) {
    return null;
  }

  return {
    moduleId,
    version: '0',
    success: true,
    data: uiState.result as T,
    executedAt: new Date().toISOString(),
    ux: uiState.ux ?? undefined,
  };
}
