import type { UiSnapshot } from '@/lib/api';
import type { ModuleExecutionView } from '../types';

export function getModuleExecution(
  snapshot: UiSnapshot | null,
  moduleId: string
): ModuleExecutionView | null {
  if (!snapshot) {
    return null;
  }

  const history = snapshot.executionsByModuleId[moduleId];
  if (!history || history.length === 0) {
    return null;
  }

  return history[history.length - 1] ?? null;
}
