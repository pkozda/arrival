import type { AppContext, ModuleExecutionResult } from '@arrival-atlas/core';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import { wrapLegacyExecutionResult } from '@arrival-atlas/module-runtime';
import type {
  ContractSnapshot,
  ModuleExecuteProjectionResponse,
} from '@arrival-atlas/product-contract';
import { projectModuleUI } from '@arrival-atlas/product-contract';
import { attachModuleResultEnvelope } from './mrc-envelope.js';
import type { AttachModuleResultEnvelopeContext } from './mrc-envelope.js';
import { buildExecuteApiResponse } from './mrc-envelope.js';
import { attachUxToExecutionResult, type UxEnrichedExecutionResult } from './ux-integration.js';

export function buildLegacyExecuteResponse<T>(
  legacy: ModuleExecutionResult<T>,
  sealedModuleResult?: ModuleResult
): UxEnrichedExecutionResult<T> & { moduleResult?: ModuleResult } {
  return buildExecuteApiResponse(attachUxToExecutionResult(legacy), sealedModuleResult);
}

export function sealModuleResultForProjection(
  legacy: ModuleExecutionResult,
  executionId: string,
  context?: AttachModuleResultEnvelopeContext
): ModuleResult {
  return (
    attachModuleResultEnvelope(legacy, executionId, context) ??
    wrapLegacyExecutionResult(legacy, {
      executionId,
      executedAt: legacy.executedAt,
    })
  );
}

export function buildProjectionExecuteResponse(
  sealedModuleResult: ModuleResult,
  contractSnapshot: ContractSnapshot,
  meta: { executionId: string; duration: number }
): ModuleExecuteProjectionResponse {
  return {
    projection: projectModuleUI(sealedModuleResult, contractSnapshot),
    meta,
  };
}

export function isLegacyExecuteContract(query: Record<string, unknown>): boolean {
  return query.contractVersion === 'legacy';
}

export type ExecuteEnvelopeContext = AttachModuleResultEnvelopeContext & {
  appContext?: AppContext;
};
