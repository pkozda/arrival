import type { ModuleExecutionResult } from '@arrival-atlas/core';
import { mapExecutionFailureToModuleError, type ModuleError } from '@arrival-atlas/module-sdk';

export function mapExecuteFailureResponse(params: {
  result: ModuleExecutionResult;
  projectionResponse: {
    projection: unknown;
    meta?: { executionId: string; duration: number };
  };
}): {
  projection: unknown;
  meta?: { executionId: string; duration: number };
  error: ModuleError;
} {
  return {
    ...params.projectionResponse,
    error: mapExecutionFailureToModuleError(params.result),
  };
}
