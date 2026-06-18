import type { ModuleUIProjection } from '../ModuleUIProjection.js';
import type { ExecutionSnapshot } from './types.js';

export type StoredExecutionProjectionInput = {
  moduleId: string;
  executionId: string;
  timestamp: number;
  projection: ModuleUIProjection;
};

export function projectExecutionSnapshot(
  entry: StoredExecutionProjectionInput
): ExecutionSnapshot {
  return {
    executionId: entry.executionId,
    moduleId: entry.moduleId,
    projection: entry.projection,
    createdAt: new Date(entry.timestamp).toISOString(),
  };
}
