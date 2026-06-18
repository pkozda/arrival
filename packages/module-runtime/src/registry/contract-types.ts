import type { ModuleCapability } from '../types/ModuleCapabilities.js';

export type ModuleContractSpec = {
  runtimeContractVersion: '1.0';
  capabilities: readonly ModuleCapability[];
  requiresRecommendationNormalizer: boolean;
  requiresActionNormalizer: boolean;
};

export type RegisteredModuleContract = {
  moduleId: string;
  name: string;
  version: string;
  spec: ModuleContractSpec;
};

export type RecommendationNormalizer = (payload: unknown) => readonly unknown[];

export type ActionNormalizer = (
  moduleId: string,
  payload: unknown
) => readonly unknown[];

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: readonly string[] };

export type GuardResult =
  | { ok: true }
  | { ok: false; error: string };
