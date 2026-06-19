import type { ModuleRegistration } from '@arrival-atlas/core';
import type { ModuleRegistry } from '@arrival-atlas/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildActionItems } from '../normalizers/actions/buildActionItems.js';
import { normalizeRecommendations } from '../normalizers/normalizeRecommendations.js';
import type {
  ActionNormalizer,
  RecommendationNormalizer,
  RegisteredModuleContract,
} from '../registry/contract-types.js';
import { resolveModuleContractSpec } from '../registry/module-contract-definitions.js';
import { validateModuleRegistration } from '../registry/validate-module-registration.js';
import {
  validateActionNormalizer,
  validateRecommendationNormalizer,
} from '../registry/validate-normalizers.js';
import {
  buildGovernedRegistry,
  type GovernedModuleRegistry,
} from './GovernedModuleRegistry.js';
import { validateContractIntegrity } from './validateContractIntegrity.js';

const FINANCIAL_SAMPLE_PAYLOADS = [
  {},
  {
    meta: { confidence: 'high' },
    decisions: [
      {
        title: 'Tax review',
        description: 'Review options.',
        priority: 'high',
        action: 'Contact Finanzamt',
      },
    ],
    benefits: { buergergeld: { eligible: false, reasoning: [] } },
  },
] as const;

const BENEFITS_SAMPLE_PAYLOADS = [
  {},
  {
    meta: { confidence: 'medium' },
    riskWarnings: [
      {
        id: 'warn-1',
        severity: 'high',
        title: 'Risk',
        description: 'Review risk.',
        category: 'legal',
        action: 'Contact Jobcenter',
      },
    ],
    recommendations: [],
  },
] as const;

function loadBenefitsGoldenPayloads(): unknown[] {
  try {
    const fixturesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../tests/fixtures/benefits-simulator-scenarios.json'
    );
    const fixture = JSON.parse(readFileSync(fixturesPath, 'utf8')) as {
      fixtures: Array<{ id: string; input: unknown }>;
    };

    return fixture.fixtures
      .filter((entry) => entry.id.startsWith('S0'))
      .slice(0, 4)
      .map((entry) => entry.input);
  } catch {
    return [];
  }
}

export type GovernedRuntimeBootstrap = {
  governedRegistry: GovernedModuleRegistry;
};

function registerBuiltInNormalizers(
  modules: Record<string, RegisteredModuleContract>,
  recommendationNormalizers: Record<string, RecommendationNormalizer>,
  actionNormalizers: Record<string, ActionNormalizer>
): void {
  const benefitsGoldenPayloads = loadBenefitsGoldenPayloads();
  const benefitsValidationPayloads =
    benefitsGoldenPayloads.length > 0
      ? [...BENEFITS_SAMPLE_PAYLOADS, ...benefitsGoldenPayloads]
      : [...BENEFITS_SAMPLE_PAYLOADS];

  const financialRecommendationNormalizer: RecommendationNormalizer = (payload) =>
    normalizeRecommendations({ moduleId: 'financial-reality', payload });
  const financialActionNormalizer: ActionNormalizer = (moduleId, payload) =>
    buildActionItems({ moduleId, payload });
  const benefitsRecommendationNormalizer: RecommendationNormalizer = (payload) =>
    normalizeRecommendations({ moduleId: 'benefits-simulator', payload });
  const benefitsActionNormalizer: ActionNormalizer = (moduleId, payload) =>
    buildActionItems({ moduleId, payload });

  const financialRecommendationValidation = validateRecommendationNormalizer(
    financialRecommendationNormalizer,
    FINANCIAL_SAMPLE_PAYLOADS
  );
  if (!financialRecommendationValidation.valid) {
    throw new Error(
      `Financial recommendation normalizer invalid: ${financialRecommendationValidation.errors.join('; ')}`
    );
  }

  const financialActionValidation = validateActionNormalizer(
    financialActionNormalizer,
    'financial-reality',
    FINANCIAL_SAMPLE_PAYLOADS
  );
  if (!financialActionValidation.valid) {
    throw new Error(
      `Financial action normalizer invalid: ${financialActionValidation.errors.join('; ')}`
    );
  }

  const benefitsRecommendationValidation = validateRecommendationNormalizer(
    benefitsRecommendationNormalizer,
    benefitsValidationPayloads
  );
  if (!benefitsRecommendationValidation.valid) {
    throw new Error(
      `Benefits recommendation normalizer invalid: ${benefitsRecommendationValidation.errors.join('; ')}`
    );
  }

  const benefitsActionValidation = validateActionNormalizer(
    benefitsActionNormalizer,
    'benefits-simulator',
    benefitsValidationPayloads
  );
  if (!benefitsActionValidation.valid) {
    throw new Error(
      `Benefits action normalizer invalid: ${benefitsActionValidation.errors.join('; ')}`
    );
  }

  recommendationNormalizers['financial-reality'] = financialRecommendationNormalizer;
  recommendationNormalizers['benefits-simulator'] = benefitsRecommendationNormalizer;
  actionNormalizers['financial-reality'] = financialActionNormalizer;
  actionNormalizers['benefits-simulator'] = benefitsActionNormalizer;

  void modules;
}

export function registerModules(
  coreRegistry: ModuleRegistry,
  registrations: readonly ModuleRegistration[]
): Record<string, RegisteredModuleContract> {
  const modules: Record<string, RegisteredModuleContract> = {};
  const seenIds = new Set<string>();

  for (const registration of registrations) {
    const validation = validateModuleRegistration(registration, { existingIds: seenIds });
    if (!validation.valid) {
      throw new Error(
        `Invalid module registration "${registration.id}": ${validation.errors.join('; ')}`
      );
    }

    seenIds.add(registration.id);

    if (!coreRegistry.get(registration.id)) {
      coreRegistry.register(registration);
    }

    modules[registration.id] = {
      moduleId: registration.id,
      name: registration.name,
      version: registration.version,
      spec: resolveModuleContractSpec(registration.id),
    };
  }

  return modules;
}

export function bindNormalizers(
  modules: Record<string, RegisteredModuleContract>
): {
  recommendationNormalizers: Record<string, RecommendationNormalizer>;
  actionNormalizers: Record<string, ActionNormalizer>;
} {
  const recommendationNormalizers: Record<string, RecommendationNormalizer> = {};
  const actionNormalizers: Record<string, ActionNormalizer> = {};
  registerBuiltInNormalizers(modules, recommendationNormalizers, actionNormalizers);
  return { recommendationNormalizers, actionNormalizers };
}

export function buildGovernedRegistryFromState(
  coreRegistry: ModuleRegistry,
  modules: Record<string, RegisteredModuleContract>,
  recommendationNormalizers: Record<string, RecommendationNormalizer>,
  actionNormalizers: Record<string, ActionNormalizer>
): GovernedModuleRegistry {
  return buildGovernedRegistry({
    modules,
    recommendationNormalizers,
    actionNormalizers,
    getRegistration: (moduleId) => coreRegistry.get(moduleId),
    listRegistrations: (includeDisabled) => coreRegistry.list(includeDisabled),
    executeModule: (moduleId, input, context) => coreRegistry.execute(moduleId, input, context),
  });
}

export function freezeGovernanceKernel(coreRegistry: ModuleRegistry): void {
  coreRegistry.freezeRegistration();
}

export function bootstrapGovernedRuntime(
  coreRegistry: ModuleRegistry,
  registrations: readonly ModuleRegistration[]
): GovernedRuntimeBootstrap {
  if (coreRegistry.isRegistrationFrozen()) {
    throw new Error('Core module registry is already frozen');
  }

  const modules = registerModules(coreRegistry, registrations);
  const integrity = validateContractIntegrity(coreRegistry, modules);
  if (!integrity.valid) {
    throw new Error(`Contract integrity check failed: ${integrity.errors.join('; ')}`);
  }

  const { recommendationNormalizers, actionNormalizers } = bindNormalizers(modules);
  const governedRegistry = buildGovernedRegistryFromState(
    coreRegistry,
    modules,
    recommendationNormalizers,
    actionNormalizers
  );

  const contractValidation = governedRegistry.validateRegistrations();
  if (!contractValidation.valid) {
    throw new Error(
      `Governance kernel invalid: ${contractValidation.errors.join('; ')}`
    );
  }

  freezeGovernanceKernel(coreRegistry);

  return { governedRegistry };
}
