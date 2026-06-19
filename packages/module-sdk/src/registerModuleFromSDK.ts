import type { ModuleExecutionResult } from '@arrival-atlas/core';
import { compileModuleRegistration } from './compileModuleRegistration.js';
import type { SdkModuleDefinition } from './types/SdkModuleDefinition.js';
import type { ModuleError, ModuleErrorCategory } from './types/ModuleError.js';
import { assertModuleIsolation } from './validateIsolation.js';
import {
  validateModuleVersioning,
  validateModuleVersioningCatalog,
  type ModuleVersionBaseline,
  type VersioningViolation,
} from './validateModuleVersioning.js';
import type { CompiledModuleCatalog, CompiledSdkModule } from './types/SdkModuleDefinition.js';

export type RegisterModuleFromSdkOptions = {
  isolationRoot?: string;
  skipIsolation?: boolean;
  versionBaseline?: ModuleVersionBaseline;
};

function inferErrorCategory(message: string): ModuleErrorCategory {
  const normalized = message.toLowerCase();

  if (normalized.includes('validation') || normalized.includes('invalid input')) {
    return 'validation';
  }

  if (normalized.includes('policy') || normalized.includes('denied')) {
    return 'policy';
  }

  if (normalized.includes('internal') || normalized.includes('unexpected')) {
    return 'internal';
  }

  return 'domain';
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\s+at\s+.+:\d+:\d+/g, '')
    .replace(/Error:\s*/g, '')
    .trim();
}

export function mapExecutionFailureToModuleError(
  result: Pick<ModuleExecutionResult, 'error' | 'moduleId'>,
  fallbackMessage = 'Module execution failed'
): ModuleError {
  const message = sanitizeErrorMessage(result.error ?? fallbackMessage);

  return {
    code: message
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'MODULE_EXECUTION_FAILED',
    category: inferErrorCategory(message),
    retryable: false,
    message,
  };
}

export function registerModuleFromSDK(
  definition: SdkModuleDefinition,
  options: RegisterModuleFromSdkOptions = {}
): CompiledSdkModule {
  if (!options.skipIsolation && options.isolationRoot) {
    assertModuleIsolation(options.isolationRoot);
  }

  const compiled = compileModuleRegistration(definition);

  if (options.versionBaseline) {
    const violations = validateModuleVersioning({
      moduleId: compiled.contract.moduleId,
      version: compiled.contract.version,
      baseline: options.versionBaseline.modules[compiled.contract.moduleId],
      fingerprints: compiled.fingerprints,
    });

    if (violations.length > 0) {
      throw new Error(
        `Module versioning policy violated for "${compiled.contract.moduleId}": ${violations
          .map((violation) => violation.message)
          .join('; ')}`
      );
    }
  }

  return compiled;
}

export function registerModulesFromSDK(
  definitions: SdkModuleDefinition[],
  options: RegisterModuleFromSdkOptions = {}
): CompiledModuleCatalog {
  const registrations = [];
  const contracts = [];
  const fingerprintsByModuleId: CompiledModuleCatalog['fingerprintsByModuleId'] = {};
  const versioningViolations: VersioningViolation[] = [];

  for (const definition of definitions) {
    const compiled = registerModuleFromSDK(definition, {
      ...options,
      skipIsolation: true,
    });
    registrations.push(compiled.registration);
    contracts.push(compiled.contract);
    fingerprintsByModuleId[compiled.contract.moduleId] = compiled.fingerprints;
  }

  if (options.versionBaseline) {
    versioningViolations.push(
      ...validateModuleVersioningCatalog({
        modules: contracts.map((contract) => ({
          moduleId: contract.moduleId,
          version: contract.version,
          fingerprints: fingerprintsByModuleId[contract.moduleId]!,
        })),
        baseline: options.versionBaseline,
      })
    );
  }

  if (!options.skipIsolation && options.isolationRoot) {
    assertModuleIsolation(options.isolationRoot);
  }

  if (versioningViolations.length > 0) {
    throw new Error(
      `Module versioning policy violated: ${versioningViolations
        .map((violation) => violation.message)
        .join('; ')}`
    );
  }

  return {
    registrations,
    contracts,
    fingerprintsByModuleId,
  };
}
