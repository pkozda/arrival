import type { ModuleResult } from '../types/ModuleResult.js';
import { readPayloadConfidence, readPayloadDisclaimer } from './read-payload-confidence.js';

export type LegacyDomainToModuleResultParams = {
  moduleId: string;
  moduleVersion?: string;
  executionId: string;
  executedAt: string;
};

export function legacyDomainToModuleResult(
  legacyResult: unknown,
  params: LegacyDomainToModuleResultParams
): ModuleResult {
  const disclaimer = readPayloadDisclaimer(legacyResult);

  return {
    status: 'success',
    meta: {
      moduleId: params.moduleId,
      moduleVersion: params.moduleVersion ?? 'unknown',
      runtimeContractVersion: '1.0',
      executionId: params.executionId,
      executedAt: params.executedAt,
      confidence: readPayloadConfidence(legacyResult),
      ...(disclaimer !== undefined ? { disclaimer } : {}),
    },
    payload: legacyResult,
  };
}
