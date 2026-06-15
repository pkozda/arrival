import type { ModuleMergeStrategy } from './types.js';

const strategies = new Map<string, ModuleMergeStrategy>();

export function registerModuleMergeStrategy(strategy: ModuleMergeStrategy): void {
  strategies.set(strategy.moduleId, strategy);
}

export function getModuleMergeStrategy(moduleId: string): ModuleMergeStrategy | undefined {
  return strategies.get(moduleId);
}

export function unregisterModuleMergeStrategy(moduleId: string): boolean {
  return strategies.delete(moduleId);
}

/** @internal Test helper */
export function clearModuleMergeStrategies(): void {
  strategies.clear();
}
