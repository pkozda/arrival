import { randomUUID } from 'node:crypto';
import type { AppContext, ModuleExecutionResult } from '@arrivalos/core';
import type { ExecutionTrace, ProfileEngine } from '@arrivalos/profile';
import { resolveExecutionContext } from '@arrivalos/profile';
import { toModuleRuntimeContext } from '../adapters/toModuleRuntimeContext.js';
import { buildModuleResultEnvelope } from '../enrichment/buildModuleResultEnvelope.js';
import { isMrcEnvelopeEnabled } from '../config/mrc-envelope.js';
import type { GovernedModuleRegistry } from '../governance/GovernedModuleRegistry.js';
import type { ModuleResult } from '../types/ModuleResult.js';
import type { ModuleRuntimeContext } from '../types/ModuleRuntimeContext.js';

export type ExecuteModuleParams = {
  moduleId: string;
  sessionId: string;
  accountId: string | null;
  requestInput: Record<string, unknown>;
  requestContext?: Partial<AppContext> & {
    inputOverrides?: Record<string, unknown>;
  };
  inputOverrides?: Record<string, unknown>;
  executionId?: string;
};

export type ModuleRuntimeExecuteOutcome = {
  /** Unchanged legacy execution result from the registry. */
  legacy: ModuleExecutionResult;
  /** @deprecated Use `legacy` — retained for MRC-1 compatibility. */
  result: ModuleExecutionResult;
  envelope?: ModuleResult;
  context: AppContext;
  mergedInput: Record<string, unknown>;
  trace: ExecutionTrace;
  runtimeContext: ModuleRuntimeContext;
};

export type ModuleRuntimeDeps = {
  profileEngine: ProfileEngine;
  governedRegistry: GovernedModuleRegistry;
};

/**
 * Execution kernel wrapper. MRC-2 optionally produces a ModuleResult envelope
 * without changing registry output or module logic.
 */
export class ModuleRuntime {
  constructor(private readonly deps: ModuleRuntimeDeps) {}

  async execute(params: ExecuteModuleParams): Promise<ModuleRuntimeExecuteOutcome> {
    const traceId = randomUUID();
    const executedAt = new Date().toISOString();
    const executionId = params.executionId ?? randomUUID();

    const { context, mergedInput, trace } = await resolveExecutionContext(
      this.deps.profileEngine,
      {
        sessionId: params.sessionId,
        moduleId: params.moduleId,
        requestInput: params.requestInput,
        requestContext: params.requestContext,
        inputOverrides: params.inputOverrides,
      }
    );

    const runtimeContext = toModuleRuntimeContext(context, {
      moduleId: params.moduleId,
      traceId,
      executedAt,
      accountId: params.accountId,
    });

    const legacy = await this.deps.governedRegistry.executeGovernedModule(
      params.moduleId,
      mergedInput,
      context
    );

    const outcome: ModuleRuntimeExecuteOutcome = {
      legacy,
      result: legacy,
      context,
      mergedInput,
      trace,
      runtimeContext,
    };

    if (isMrcEnvelopeEnabled()) {
      outcome.envelope = buildModuleResultEnvelope(
        legacy,
        {
          executionId,
          executedAt: legacy.executedAt,
        },
        {
          moduleId: params.moduleId,
          runtimeContext,
          mergedInput,
          governedRegistry: this.deps.governedRegistry,
        }
      );
    }

    return outcome;
  }
}
