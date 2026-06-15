import { describe, it, expect, afterEach } from 'vitest';
import {
  adaptLegacyInputToV2,
  adaptV2OutputToLegacy,
  financialPipeline,
} from '@arrivalos/shared-services';
import { InMemoryProfileStore, ProfileEngine, resolveExecutionContext } from '@arrivalos/profile';
import {
  financialRealityModule,
  setAdvancedTaxScenarios,
  isAdvancedTaxScenariosEnabled,
} from './index.js';
import { resolveFinancialProfileContext } from './profile-context.js';

describe('v1 adapter', () => {
  it('maps legacy input to v2 engine input', () => {
    const v2Input = adaptLegacyInputToV2({
      grossIncome: 2500,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'employed',
      maritalStatus: 'single',
    });
    expect(v2Input.taxYear).toBe(2025);
    expect(v2Input.baseline.employments.applicant).toMatchObject({ type: 'regular' });
  });

  it('produces v1-compatible output shape from v2 pipeline', () => {
    const v2Input = adaptLegacyInputToV2({
      grossIncome: 2500,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'employed',
      maritalStatus: 'single',
    });
    const v2 = financialPipeline.run(v2Input);
    const legacy = adaptV2OutputToLegacy(v2);

    expect(legacy.income).toHaveProperty('gross');
    expect(legacy.income).toHaveProperty('net');
    expect(legacy.income.deductions).toHaveProperty('incomeTax');
    expect(legacy.benefits.buergergeld).toHaveProperty('eligible');
    expect(Array.isArray(legacy.decisions)).toBe(true);
    expect(Array.isArray(legacy.adminRules)).toBe(true);
    expect(legacy.meta).toBeDefined();
  });

  it('supports scenario comparison via proposedGrossIncome', () => {
    const v2Input = adaptLegacyInputToV2({
      grossIncome: 0,
      taxClass: 1,
      churchTax: false,
      householdSize: 1,
      monthlyRent: 800,
      employmentStatus: 'unemployed',
      maritalStatus: 'single',
      proposedGrossIncome: 1200,
    });
    expect(v2Input.mode).toBe('compare');
    expect(v2Input.proposed).toBeDefined();
    expect(v2Input.proposed?.employments.applicant).toMatchObject({ type: 'midijob' });

    const result = financialPipeline.run(v2Input);
    expect(result.comparison).toBeDefined();
    expect(result.comparison?.effectiveGainFromWork).toBeGreaterThan(0);
    expect(result.verdict.summary).not.toMatch(/reduce total household resources/);
  });
});

describe('Financial Reality Module', () => {
  afterEach(() => {
    setAdvancedTaxScenarios(true);
  });

  it('executes v2 engine when advancedTaxScenarios is enabled', async () => {
    setAdvancedTaxScenarios(true);
    expect(isAdvancedTaxScenariosEnabled()).toBe(true);

    const result = await financialRealityModule.execute(
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      {}
    );

    expect(result.meta?.engineVersion).toBe('2.0.0');
    expect(result.income.net).toBeGreaterThan(0);
  });

  it('executes v1 engine when advancedTaxScenarios is disabled', async () => {
    setAdvancedTaxScenarios(false);

    const result = await financialRealityModule.execute(
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      {}
    );

    expect(result.meta).toBeUndefined();
    expect(result.income.net).toBeGreaterThan(0);
  });

  it('v2 output passes module output schema validation', async () => {
    const result = await financialRealityModule.execute(
      {
        grossIncome: 0,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'unemployed',
        maritalStatus: 'single',
      },
      {}
    );
    expect(() => financialRealityModule.outputSchema.parse(result)).not.toThrow();
  });

  it('evaluates admin rules from profileSlice instead of systemState', async () => {
    const result = await financialRealityModule.execute(
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      {
        profileSlice: {
          preferredLanguage: 'de',
          insurance: { hasCoverage: true },
          benefits: { daysInGermany: 90 },
        },
      }
    );

    expect(result.adminRules.some((rule) => rule.includes('Anmeldung'))).toBe(true);
    expect(result.adminRules.some((rule) => rule.includes('Krankenversicherung'))).toBe(false);
  });

  it('does not assume health insurance when profile context is missing', async () => {
    const result = await financialRealityModule.execute(
      {
        grossIncome: 2500,
        taxClass: 1,
        churchTax: false,
        householdSize: 1,
        monthlyRent: 800,
        employmentStatus: 'employed',
        maritalStatus: 'single',
      },
      {}
    );

    expect(result.adminRules.some((rule) => rule.includes('Krankenversicherung'))).toBe(true);
    expect(result.adminRules.some((rule) => rule.includes('Anmeldung'))).toBe(false);
  });

  it('resolves admin rules from profileSlice via the real profile pipeline', async () => {
    const store = new InMemoryProfileStore();
    const engine = new ProfileEngine(store);
    const sessionId = 'sess_fr_pipeline';

    const profile = await engine.createProfile({ preferredLanguage: 'de' });
    await engine.bindSession(sessionId, profile.id);
    await engine.updateProfile(
      profile.id,
      {
        employment: {
          grossMonthlyIncome: 2500,
          taxClass: 1,
          churchTax: false,
          status: 'employed',
        },
        household: { size: 1, maritalStatus: 'single' },
        housing: { monthlyColdRent: 800 },
        insurance: { hasCoverage: true, type: 'public' },
        benefits: { daysInGermany: 90 },
      },
      1
    );

    const { context, mergedInput } = await resolveExecutionContext(engine, {
      sessionId,
      moduleId: 'financial-reality',
      requestInput: {},
    });

    const profileContext = resolveFinancialProfileContext(
      context,
      mergedInput as Record<string, unknown>
    );
    expect(profileContext.hasHealthInsurance).toBe(true);
    expect(profileContext.daysInGermany).toBe(90);

    const result = await financialRealityModule.execute(
      mergedInput as Parameters<typeof financialRealityModule.execute>[0],
      context
    );

    expect(result.adminRules.some((rule) => rule.includes('Anmeldung'))).toBe(true);
    expect(result.adminRules.some((rule) => rule.includes('Krankenversicherung'))).toBe(false);
  });
});
