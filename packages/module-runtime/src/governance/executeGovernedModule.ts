import type { AppContext, ModuleExecutionResult } from '@arrival-atlas/core';
import type { GovernedModuleRegistry } from './GovernedModuleRegistry.js';

export async function executeGovernedModule<TInput, TOutput>(
  governedRegistry: GovernedModuleRegistry,
  moduleId: string,
  input: TInput,
  context: AppContext
): Promise<ModuleExecutionResult<TOutput>> {
  return governedRegistry.executeGovernedModule<TInput, TOutput>(moduleId, input, context);
}
