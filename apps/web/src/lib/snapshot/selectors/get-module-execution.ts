import type { UiSnapshot } from '@/lib/api';
import type { ModuleExecutionView } from '../types';

export function getModuleExecution(
  snapshot: UiSnapshot | null,
  moduleId: string
): ModuleExecutionView | null {
  if (!snapshot) {
    return null;
  }

  const matches = snapshot.executions.filter((entry) => entry.moduleId === moduleId);
  if (matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1] ?? null;
}
