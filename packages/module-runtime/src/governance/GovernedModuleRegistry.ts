import type { AppContext, ModuleExecutionResult, ModuleRegistration } from '@arrivalos/core';
import type { ModuleCapabilities } from '../types/ModuleCapabilities.js';
import type { ActionItem } from '../types/ActionItem.js';
import type { Recommendation } from '../types/Recommendation.js';
import type {
  ActionNormalizer,
  RecommendationNormalizer,
  RegisteredModuleContract,
} from '../registry/contract-types.js';
import { authorizeExecution } from './authorizeExecution.js';
import type { PolicyDecision } from './types.js';

export type ModuleRuntimeCapabilities = ModuleCapabilities & {
  moduleId: string;
  version: string;
  runtimeContractVersion: '1.0';
  supportsRecommendations: boolean;
  supportsActions: boolean;
  executionConstraints: readonly string[];
};

export type GovernedModuleRegistrySnapshot = {
  frozen: true;
  modules: readonly RegisteredModuleContract[];
  recommendationNormalizers: readonly string[];
  actionNormalizers: readonly string[];
};

export type GovernedModuleRegistry = {
  readonly frozen: true;
  get(moduleId: string): ModuleRegistration | undefined;
  list(includeDisabled?: boolean): ModuleRegistration[];
  getModuleContract(moduleId: string): RegisteredModuleContract | undefined;
  getCapabilities(moduleId: string): ModuleRuntimeCapabilities | undefined;
  hasRecommendationNormalizer(moduleId: string): boolean;
  hasActionNormalizer(moduleId: string): boolean;
  authorizeExecution(moduleId: string, input: unknown): PolicyDecision;
  normalizeRecommendations(moduleId: string, payload: unknown): readonly Recommendation[];
  normalizeActions(
    moduleId: string,
    payload: unknown,
    recommendations?: readonly Recommendation[]
  ): readonly ActionItem[];
  listModuleIds(): readonly string[];
  validateRegistrations(): { valid: true } | { valid: false; errors: readonly string[] };
  executeGovernedModule<TInput, TOutput>(
    moduleId: string,
    input: TInput,
    context: AppContext
  ): Promise<ModuleExecutionResult<TOutput>>;
  toSnapshot(): GovernedModuleRegistrySnapshot;
};

export type GovernedRegistryBuildInput = {
  modules: Record<string, RegisteredModuleContract>;
  recommendationNormalizers: Record<string, RecommendationNormalizer>;
  actionNormalizers: Record<string, ActionNormalizer>;
  getRegistration(moduleId: string): ModuleRegistration | undefined;
  listRegistrations(includeDisabled?: boolean): ModuleRegistration[];
  executeModule<TInput, TOutput>(
    moduleId: string,
    input: TInput,
    context: AppContext
  ): Promise<ModuleExecutionResult<TOutput>>;
};

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }

    return value;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }

  return value;
}

export function buildGovernedRegistry(buildInput: GovernedRegistryBuildInput): GovernedModuleRegistry {
  const modules = deepFreeze(structuredClone(buildInput.modules));
  const recommendationNormalizers = buildInput.recommendationNormalizers;
  const actionNormalizers = buildInput.actionNormalizers;

  const kernelState = {
    modules,
    recommendationNormalizers,
    actionNormalizers,
    getRegistration: buildInput.getRegistration,
  };

  const registry: GovernedModuleRegistry = {
    frozen: true,

    get(moduleId: string) {
      return buildInput.getRegistration(moduleId);
    },

    list(includeDisabled = false) {
      return buildInput.listRegistrations(includeDisabled);
    },

    getModuleContract(moduleId: string) {
      return modules[moduleId];
    },

    getCapabilities(moduleId: string) {
      const contract = modules[moduleId];
      if (!contract) {
        return undefined;
      }

      const supportsRecommendations =
        contract.spec.capabilities.includes('produces-recommendations');
      const supportsActions = contract.spec.capabilities.includes('produces-actions');

      return {
        moduleId: contract.moduleId,
        version: contract.version,
        runtimeContractVersion: contract.spec.runtimeContractVersion,
        capabilities: contract.spec.capabilities,
        requiredProfileFields: contract.spec.requiresRecommendationNormalizer
          ? ['profileSlice']
          : [],
        forbiddenProfileFields: [],
        entitlementKey: null,
        supportsRecommendations,
        supportsActions,
        executionConstraints: [
          'deterministic-execute',
          'side-effect-free',
          ...(contract.spec.requiresRecommendationNormalizer
            ? ['requires-recommendation-normalizer']
            : []),
          ...(contract.spec.requiresActionNormalizer ? ['requires-action-normalizer'] : []),
        ],
      };
    },

    hasRecommendationNormalizer(moduleId: string) {
      return recommendationNormalizers[moduleId] !== undefined;
    },

    hasActionNormalizer(moduleId: string) {
      return actionNormalizers[moduleId] !== undefined;
    },

    authorizeExecution(moduleId: string, inputValue: unknown) {
      return authorizeExecution(kernelState, { moduleId, input: inputValue });
    },

    async executeGovernedModule<TInput, TOutput>(
      moduleId: string,
      inputValue: TInput,
      context: AppContext
    ): Promise<ModuleExecutionResult<TOutput>> {
      const decision = authorizeExecution(kernelState, { moduleId, input: inputValue });
      if (!decision.authorized) {
        const registration = buildInput.getRegistration(moduleId);
        return {
          moduleId,
          version: registration?.version ?? 'unknown',
          success: false,
          error: decision.reason,
          executedAt: new Date().toISOString(),
        };
      }

      return buildInput.executeModule<TInput, TOutput>(moduleId, inputValue, context);
    },

    normalizeRecommendations(moduleId: string, payload: unknown) {
      const normalizer = recommendationNormalizers[moduleId];
      if (!normalizer) {
        return [];
      }

      return normalizer(payload) as readonly Recommendation[];
    },

    normalizeActions(
      moduleId: string,
      payload: unknown,
      recommendations?: readonly Recommendation[]
    ) {
      const normalizer = actionNormalizers[moduleId];
      if (!normalizer) {
        return [];
      }

      void recommendations;
      return normalizer(moduleId, payload) as readonly ActionItem[];
    },

    listModuleIds() {
      return Object.freeze(Object.keys(modules).sort());
    },

    validateRegistrations() {
      const errors: string[] = [];

      for (const contract of Object.values(modules)) {
        if (
          contract.spec.requiresRecommendationNormalizer &&
          recommendationNormalizers[contract.moduleId] === undefined
        ) {
          errors.push(
            `Module "${contract.moduleId}" requires a recommendation normalizer`
          );
        }

        if (
          contract.spec.requiresActionNormalizer &&
          actionNormalizers[contract.moduleId] === undefined
        ) {
          errors.push(`Module "${contract.moduleId}" requires an action normalizer`);
        }
      }

      return errors.length > 0 ? { valid: false, errors } : { valid: true };
    },

    toSnapshot() {
      return {
        frozen: true,
        modules: Object.freeze(Object.values(modules)),
        recommendationNormalizers: Object.freeze(Object.keys(recommendationNormalizers).sort()),
        actionNormalizers: Object.freeze(Object.keys(actionNormalizers).sort()),
      };
    },
  };

  return deepFreeze(registry);
}
