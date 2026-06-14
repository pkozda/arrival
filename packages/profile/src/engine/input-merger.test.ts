import { describe, it, expect } from 'vitest';
import { mergeModuleInput } from './input-merger.js';
import type { ProfileDocument } from '../types/profile-document.js';

const sampleProfile: ProfileDocument = {
  schemaVersion: '1.0.0',
  preferredLanguage: 'de',
  employment: {
    grossMonthlyIncome: 2500,
    taxClass: 2,
    churchTax: false,
    status: 'employed',
  },
  household: {
    size: 3,
    maritalStatus: 'single',
  },
  housing: {
    monthlyColdRent: 900,
  },
  extensions: {},
};

describe('mergeModuleInput', () => {
  it('uses request input over profile values', () => {
    const { merged, provenance } = mergeModuleInput('financial-reality', {
      requestInput: { grossIncome: 3000 },
      profile: sampleProfile,
    });

    expect(merged.grossIncome).toBe(3000);
    expect(provenance.find((p) => p.field === 'grossIncome')?.source).toBe('input');
  });

  it('uses profile values when request input is absent', () => {
    const { merged, provenance } = mergeModuleInput('financial-reality', {
      requestInput: {},
      profile: sampleProfile,
    });

    expect(merged.grossIncome).toBe(2500);
    expect(merged.householdSize).toBe(3);
    expect(merged.monthlyRent).toBe(900);
    expect(merged.taxClass).toBe(2);
    expect(provenance.find((p) => p.field === 'grossIncome')?.source).toBe('profile');
  });

  it('uses request overrides between input and profile', () => {
    const { merged, provenance } = mergeModuleInput('financial-reality', {
      requestInput: {},
      requestOverrides: { monthlyRent: 1100 },
      profile: sampleProfile,
    });

    expect(merged.monthlyRent).toBe(1100);
    expect(provenance.find((p) => p.field === 'monthlyRent')?.source).toBe('override');
  });

  it('falls back to defaults when profile and input are empty', () => {
    const { merged, provenance } = mergeModuleInput('financial-reality', {
      requestInput: {},
      profile: null,
    });

    expect(merged.grossIncome).toBe(0);
    expect(merged.householdSize).toBe(1);
    expect(merged.employmentStatus).toBe('employed');
    expect(provenance.find((p) => p.field === 'grossIncome')?.source).toBe('default');
  });
});
