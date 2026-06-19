import type { AppContext, ModuleExecutionResult } from '@arrival-atlas/core';
import type { ModuleResult } from '@arrival-atlas/module-runtime';
import {
  buildModuleResultEnvelope,
  toModuleRuntimeContext,
  type SemanticEnrichmentContext,
} from '@arrival-atlas/module-runtime';

export type AttachModuleResultEnvelopeContext = SemanticEnrichmentContext & {
  appContext?: AppContext;
  accountId?: string | null;
  traceId?: string;
};

export function attachModuleResultEnvelope(
  legacy: ModuleExecutionResult,
  executionId: string,
  context?: AttachModuleResultEnvelopeContext
): ModuleResult | undefined {
  const runtimeContext =
    context?.runtimeContext ??
    (context?.appContext
      ? toModuleRuntimeContext(context.appContext, {
          moduleId: context.moduleId,
          traceId: context.traceId ?? executionId,
          executedAt: legacy.executedAt,
          accountId: context.accountId ?? null,
        })
      : undefined);

  return buildModuleResultEnvelope(
    legacy,
    {
      executionId,
      executedAt: legacy.executedAt,
    },
    context
      ? {
          moduleId: context.moduleId,
          runtimeContext,
          mergedInput: context.mergedInput,
          governedRegistry: context.governedRegistry,
        }
      : undefined
  );
}

export function buildExecuteApiResponse<T>(
  legacy: ModuleExecutionResult<T>,
  moduleResult?: ModuleResult
): ModuleExecutionResult<T> & { moduleResult?: ModuleResult } {
  if (moduleResult === undefined) {
    return legacy;
  }

  return {
    ...legacy,
    moduleResult,
  };
}
