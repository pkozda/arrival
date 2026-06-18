import type { ModuleResult } from '../types/ModuleResult.js';
import { legacyDomainToModuleResult } from './legacyDomainToModuleResult.js';

export type StoredExecutionLike = {
  moduleId: string;
  executionId: string;
  timestamp: number;
  result?: unknown;
  legacyResult?: unknown;
  moduleResult?: ModuleResult;
};

export function getLegacyDomainResult(execution: StoredExecutionLike): unknown {
  if (execution.legacyResult !== undefined) {
    return execution.legacyResult;
  }

  return execution.result;
}

export function resolveExecutionResult(execution: StoredExecutionLike): ModuleResult {
  if (execution.moduleResult !== undefined) {
    return execution.moduleResult;
  }

  const legacyResult = getLegacyDomainResult(execution);
  return legacyDomainToModuleResult(legacyResult, {
    moduleId: execution.moduleId,
    executionId: execution.executionId,
    executedAt: new Date(execution.timestamp).toISOString(),
  });
}
