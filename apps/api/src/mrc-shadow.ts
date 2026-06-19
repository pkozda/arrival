import type { FastifyBaseLogger } from 'fastify';
import type { ModuleExecutionResult } from '@arrival-atlas/core';
import {
  ModuleRuntime,
  type ExecuteModuleParams,
  type ModuleRuntimeExecuteOutcome,
} from '@arrival-atlas/module-runtime';

export function isMrcShadowEnabled(): boolean {
  if (process.env.ARRIVAL_ATLAS_MRC_SHADOW === 'false') {
    return false;
  }

  if (process.env.ARRIVAL_ATLAS_MRC_SHADOW === 'true') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}

function stripNonDeterministicMeta(data: unknown): unknown {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const record = { ...(data as Record<string, unknown>) };
  if (record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)) {
    const { calculatedAt: _calculatedAt, ...meta } = record.meta as Record<string, unknown>;
    record.meta = meta;
  }

  return record;
}

function executionResultsMatch(
  primary: ModuleExecutionResult,
  shadow: ModuleExecutionResult
): boolean {
  if (primary.success !== shadow.success) {
    return false;
  }

  if (primary.moduleId !== shadow.moduleId) {
    return false;
  }

  if (primary.version !== shadow.version) {
    return false;
  }

  if (primary.error !== shadow.error) {
    return false;
  }

  return (
    JSON.stringify(stripNonDeterministicMeta(primary.data)) ===
    JSON.stringify(stripNonDeterministicMeta(shadow.data))
  );
}

/**
 * MRC-1 shadow validation: runs ModuleRuntime in parallel with the primary path.
 * Shadow outcome is never used for DPSS persistence or API responses.
 */
export function runMrcShadowValidation(
  moduleRuntime: ModuleRuntime,
  params: ExecuteModuleParams,
  primaryResult: ModuleExecutionResult,
  logger: FastifyBaseLogger
): void {
  if (!isMrcShadowEnabled()) {
    return;
  }

  void moduleRuntime
    .execute(params)
    .then((shadowOutcome: ModuleRuntimeExecuteOutcome) => {
      if (!executionResultsMatch(primaryResult, shadowOutcome.legacy)) {
        logger.warn(
          {
            moduleId: params.moduleId,
            sessionId: params.sessionId,
            primarySuccess: primaryResult.success,
            shadowSuccess: shadowOutcome.result.success,
          },
          'mrc shadow execution parity mismatch'
        );
      }
    })
    .catch((error: unknown) => {
      logger.warn({ err: error, moduleId: params.moduleId }, 'mrc shadow execute failed');
    });
}
