import type { UiSnapshot } from '@/lib/product-contract';
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

  const latest = history[history.length - 1];
  if (!latest) {
    return null;
  }

  return {
    moduleId: latest.moduleId,
    projection: latest.projection,
    createdAt: latest.createdAt,
    executionId: latest.executionId,
  };
}
