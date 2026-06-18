import type { ModuleExecutionResult } from '@arrivalos/core';
import { mapExecutionFailureToModuleError, type ModuleError } from '@arrivalos/module-sdk';

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
