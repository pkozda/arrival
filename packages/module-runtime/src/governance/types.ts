import type { ModuleRegistration } from '@arrivalos/core';
import type {
  ActionNormalizer,
  RecommendationNormalizer,
  RegisteredModuleContract,
} from '../registry/contract-types.js';

export type PolicyDecision =
  | { authorized: true }
  | { authorized: false; reason: string };

export type GovernanceExecutionContext = {
  moduleId: string;
  input: unknown;
};

export type GovernanceKernelState = {
  modules: Record<string, RegisteredModuleContract>;
  recommendationNormalizers: Record<string, RecommendationNormalizer>;
  actionNormalizers: Record<string, ActionNormalizer>;
  getRegistration(moduleId: string): ModuleRegistration | undefined;
};

export type ModuleNormalizers = {
  recommendation?: RecommendationNormalizer;
  action?: ActionNormalizer;
};
