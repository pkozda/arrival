import type { ModuleExecutionResult } from '@arrival-atlas/core';
import type { ModuleResult } from '../types/ModuleResult.js';
import { readPayloadConfidence, readPayloadDisclaimer } from './read-payload-confidence.js';

export type WrapLegacyExecutionResultParams = {
  executionId: string;
  executedAt?: string;
};

export function wrapLegacyExecutionResult(
  legacy: ModuleExecutionResult,
  params: WrapLegacyExecutionResultParams
): ModuleResult {
  const executedAt = params.executedAt ?? legacy.executedAt;

  if (!legacy.success) {
    return {
      status: 'execution_error',
      meta: {
        moduleId: legacy.moduleId,
        moduleVersion: legacy.version,
        runtimeContractVersion: '1.0',
        executionId: params.executionId,
        executedAt,
        confidence: 'medium',
      },
      error: legacy.error,
    };
  }

  const payload = legacy.data;
  const disclaimer = readPayloadDisclaimer(payload);

  return {
    status: 'success',
    meta: {
      moduleId: legacy.moduleId,
      moduleVersion: legacy.version,
      runtimeContractVersion: '1.0',
      executionId: params.executionId,
      executedAt,
      confidence: readPayloadConfidence(payload),
      ...(disclaimer !== undefined ? { disclaimer } : {}),
    },
    payload,
  };
}
