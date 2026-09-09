import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@/lib/product-contract';
import { buildTaxAdministrationViewModel } from './build-tax-administration-view-model';

function baseProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 0, missingDomains: [] },
    domains: {
      ...overrides,
    },
  } as UserProfileViewV1;
}

describe('E10 Tax Administration view model', () => {
  it('A — NOT_ADDED when tax facts absent', () => {
    const vm = buildTaxAdministrationViewModel(baseProfile({}));
    expect(vm.state).toBe('NOT_ADDED');
    expect(vm.missingFieldKeys).toContain('finance.tax.missing.taxClass');
    expect(vm.nextAction.href).toContain('work-income');
  });

  it('does not infer tax from income or household', () => {
    const vm = buildTaxAdministrationViewModel(
      baseProfile({
        income: { grossMonthlyIncome: 2500 },
        household: { householdSize: 3 },
      })
    );
    expect(vm.state).toBe('NOT_ADDED');
  });

  it('does not treat undefined churchTax as false', () => {
    const vm = buildTaxAdministrationViewModel(
      baseProfile({ employment: { taxClass: 1 } })
    );
    expect(vm.knownFacts.find((f) => f.factId === 'churchTax')?.presence).toBe('UNKNOWN');
    expect(vm.state).toBe('READY');
    expect(vm.explanationKey).toBe('finance.tax.explanation.readyTaxClassOnly');
  });

  it('B — INCOMPLETE when churchTax known but taxClass missing', () => {
    const vm = buildTaxAdministrationViewModel(
      baseProfile({ employment: { churchTax: false } })
    );
    expect(vm.state).toBe('INCOMPLETE');
    expect(vm.knownFacts.find((f) => f.factId === 'churchTax')?.presence).toBe('KNOWN');
  });

  it('C — READY when taxClass set', () => {
    const vm = buildTaxAdministrationViewModel(
      baseProfile({ employment: { taxClass: 3, churchTax: true } })
    );
    expect(vm.state).toBe('READY');
    expect(vm.knownFacts.find((f) => f.factId === 'taxClass')?.valueText).toBe('3');
    expect(vm.nextAction.kind).toBe('review_tax_details');
  });

  it('D — persistence reconstructs same derived state', () => {
    const profile = baseProfile({ employment: { taxClass: 4, churchTax: false } });
    expect(buildTaxAdministrationViewModel(profile)).toEqual(
      buildTaxAdministrationViewModel(structuredClone(profile))
    );
  });

  it('G — never invents banking completion', () => {
    const vm = buildTaxAdministrationViewModel(
      baseProfile({
        employment: { taxClass: 1, employmentStatus: 'employed' },
        housing: { city: 'Berlin' },
        migration: { municipalRegistrationConfirmed: true },
      })
    );
    expect(vm.bankingNoteKey).toBe('finance.tax.bankingDeferred');
    expect(vm.state).toBe('READY');
  });
});
