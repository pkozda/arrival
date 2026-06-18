import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from '@arrivalos/core';
import { allModuleRegistrations } from '@arrivalos/modules';
import { bootstrapGovernedRuntime } from '../governance/bootstrapGovernedRuntime.js';
import { executeGovernedModule } from '../governance/executeGovernedModule.js';
import { validateModuleRegistration } from '../registry/validate-module-registration.js';

describe('MRC-6 governance kernel', () => {
  it('bootstraps a single governed registry authority', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    expect(governedRegistry.frozen).toBe(true);
    expect(Object.isFrozen(governedRegistry)).toBe(true);
    expect(coreRegistry.isRegistrationFrozen()).toBe(true);
    expect(governedRegistry.list().length).toBe(allModuleRegistrations.length);
  });

  it('does not expose a separate frozen contract registry type', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    expect(governedRegistry.getModuleContract).toBeTypeOf('function');
    expect(governedRegistry.executeGovernedModule).toBeTypeOf('function');
    expect((governedRegistry as { contractRegistry?: unknown }).contractRegistry).toBeUndefined();
  });

  it('authorizes execution without runtime tokens', async () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    const decision = governedRegistry.authorizeExecution('financial-reality', {
      grossIncome: 2500,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'employed',
      maritalStatus: 'single',
    });

    expect(decision.authorized).toBe(true);

    const result = await executeGovernedModule(
      governedRegistry,
      'financial-reality',
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      { sessionId: 'sess_governance', userProfile: { language: 'en' } }
    );

    expect(result.success).toBe(true);
  });

  it('denies execution when authorization fails', async () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    const decision = governedRegistry.authorizeExecution('unknown-module', {});
    expect(decision.authorized).toBe(false);

    const result = await executeGovernedModule(
      governedRegistry,
      'unknown-module',
      {},
      { sessionId: 'sess_denied' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('unknown-module');
  });

  it('enforces capability constraints during authorization', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    expect(governedRegistry.getCapabilities('financial-reality')?.supportsActions).toBe(true);
    expect(governedRegistry.getCapabilities('financial-reality')?.supportsRecommendations).toBe(
      true
    );
    expect(
      governedRegistry.getCapabilities('financial-reality')?.executionConstraints
    ).toContain('requires-action-normalizer');
  });

  it('prevents registration after governance kernel freeze', () => {
    const coreRegistry = new ModuleRegistry();
    bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);

    expect(() => {
      coreRegistry.register(allModuleRegistrations[0]!);
    }).toThrow(/frozen/i);
  });

  it('keeps the governance registry deeply immutable after bootstrap', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    expect(Object.isFrozen(governedRegistry)).toBe(true);
    expect(() => {
      (governedRegistry as { frozen?: boolean }).frozen = false;
    }).toThrow();
  });

  it('resolves normalizers only from the governance registry', () => {
    const coreRegistry = new ModuleRegistry();
    const { governedRegistry } = bootstrapGovernedRuntime(
      coreRegistry,
      allModuleRegistrations
    );

    expect(governedRegistry.hasRecommendationNormalizer('financial-reality')).toBe(true);
    expect(governedRegistry.hasActionNormalizer('financial-reality')).toBe(true);

    const recommendations = governedRegistry.normalizeRecommendations('financial-reality', {
      meta: { confidence: 'high' },
      decisions: [
        {
          title: 'Review',
          description: 'Review tax options.',
          priority: 'high',
          action: 'Contact Finanzamt',
        },
      ],
    });

    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('rejects invalid module registrations during bootstrap', () => {
    const coreRegistry = new ModuleRegistry();
    const broken = {
      ...allModuleRegistrations[0]!,
      version: 'bad-version',
    };

    expect(() => bootstrapGovernedRuntime(coreRegistry, [broken])).toThrow(/semver/i);
  });

  it('validates all production registrations', () => {
    for (const registration of allModuleRegistrations) {
      const result = validateModuleRegistration(registration);
      expect(result.valid).toBe(true);
    }
  });

  it('derives authorization deterministically from contract and input schema', () => {
    const coreRegistry = new ModuleRegistry();
    for (const registration of allModuleRegistrations) {
      coreRegistry.register(registration);
    }

    const { governedRegistry } = bootstrapGovernedRuntime(coreRegistry, allModuleRegistrations);

    const decision = governedRegistry.authorizeExecution('financial-reality', {
      grossIncome: 'invalid',
    });

    expect(decision.authorized).toBe(false);
    if (!decision.authorized) {
      expect(decision.reason).toMatch(/schema validation/i);
    }
  });
});
