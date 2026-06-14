import { describe, it, expect } from 'vitest';
import {
  applyProfilePolicy,
  buildPolicyConstrainedDocument,
} from './apply-profile-policy.js';
import {
  FINANCIAL_REALITY_POLICY,
  HEALTHCARE_NAVIGATION_POLICY,
} from './module-profile-policy-registry.js';
import type { ProfileDocument } from '../types/profile-document.js';

const fullProfile: ProfileDocument = {
  schemaVersion: '1.0.0',
  preferredLanguage: 'de',
  countryOfOrigin: 'UA',
  location: { bundesland: 'BE', city: 'Berlin' },
  residency: { status: 'work-visa' },
  household: { size: 3, maritalStatus: 'single' },
  employment: {
    grossMonthlyIncome: 2500,
    taxClass: 2,
    churchTax: false,
    status: 'employed',
  },
  housing: { monthlyColdRent: 900, monthlyUtilities: 150 },
  insurance: { type: 'public', hasCoverage: true },
  benefits: { receivingBuergergeld: false, daysInGermany: 120 },
  extensions: {
    'financial-reality': { lastScenario: 'compare' },
    'healthcare-navigation': { preferredClinic: 'Charité' },
  },
};

describe('applyProfilePolicy', () => {
  it('redacts sensitive fields from ProfileSlice for financial-reality', () => {
    const slice = applyProfilePolicy(fullProfile, FINANCIAL_REALITY_POLICY);

    expect(slice.employment).toEqual(
      expect.objectContaining({
        taxClass: 2,
        status: 'employed',
        churchTax: false,
      })
    );
    expect(slice.employment?.grossMonthlyIncome).toBeUndefined();
    expect(slice.housing?.monthlyColdRent).toBeUndefined();
    expect(slice.household?.size).toBe(3);
  });

  it('excludes unrelated top-level fields from financial-reality slice', () => {
    const slice = applyProfilePolicy(fullProfile, FINANCIAL_REALITY_POLICY);

    expect(slice.insurance).toBeUndefined();
    expect(slice.benefits).toBeUndefined();
    expect(slice.residency).toBeUndefined();
    expect(slice.countryOfOrigin).toBeUndefined();
  });

  it('isolates extensions per module policy', () => {
    const financialSlice = applyProfilePolicy(fullProfile, FINANCIAL_REALITY_POLICY);
    const healthcareSlice = applyProfilePolicy(fullProfile, HEALTHCARE_NAVIGATION_POLICY);

    expect(financialSlice.extensions).toEqual({
      'financial-reality': { lastScenario: 'compare' },
    });
    expect(financialSlice.extensions?.['healthcare-navigation']).toBeUndefined();

    expect(healthcareSlice.extensions).toEqual({
      'healthcare-navigation': { preferredClinic: 'Charité' },
    });
    expect(healthcareSlice.extensions?.['financial-reality']).toBeUndefined();
  });

  it('financial module cannot see healthcare-only domains in slice', () => {
    const slice = applyProfilePolicy(fullProfile, FINANCIAL_REALITY_POLICY);
    expect(slice.insurance).toBeUndefined();
  });

  it('healthcare module cannot see employment or housing in slice', () => {
    const slice = applyProfilePolicy(fullProfile, HEALTHCARE_NAVIGATION_POLICY);

    expect(slice.employment).toBeUndefined();
    expect(slice.housing).toBeUndefined();
    expect(slice.household).toBeUndefined();
    expect(slice.location?.city).toBe('Berlin');
    expect(slice.insurance?.type).toBe('public');
  });
});

describe('buildPolicyConstrainedDocument', () => {
  it('retains sensitive nested values for authorized merge within allowed domains', () => {
    const doc = buildPolicyConstrainedDocument(fullProfile, FINANCIAL_REALITY_POLICY);

    expect(doc.employment?.grossMonthlyIncome).toBe(2500);
    expect(doc.housing?.monthlyColdRent).toBe(900);
    expect(doc.insurance).toBeUndefined();
  });
});
