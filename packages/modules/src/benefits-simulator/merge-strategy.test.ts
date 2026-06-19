import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearModuleMergeStrategies,
  getModuleMergeStrategy,
} from '@arrival-atlas/profile';
import type { ProfileDocument } from '@arrival-atlas/profile';
import { registerAllMergeStrategies } from '../index.js';
import { benefitsSimulatorMergeStrategy } from './merge-strategy.js';

const sampleProfile: ProfileDocument = {
  schemaVersion: '1.0.0',
  preferredLanguage: 'de',
  employment: {
    grossMonthlyIncome: 0,
    taxClass: 1,
    churchTax: false,
    status: 'unemployed',
  },
  household: {
    size: 2,
    maritalStatus: 'single',
  },
  housing: {
    monthlyColdRent: 800,
  },
  benefits: {
    receivingBuergergeld: true,
  },
  extensions: {},
};

describe('benefitsSimulatorMergeStrategy', () => {
  beforeEach(() => {
    clearModuleMergeStrategies();
  });

  it('registers via registerAllMergeStrategies', () => {
    registerAllMergeStrategies();
    expect(getModuleMergeStrategy('benefits-simulator')).toBe(
      benefitsSimulatorMergeStrategy
    );
  });

  it('hydrates household and baseline employments from profile', () => {
    const { merged, provenance } = benefitsSimulatorMergeStrategy.merge({
      requestInput: {},
      profile: sampleProfile,
    });

    expect(merged.taxYear).toBe(2025);
    expect(merged.household).toBeDefined();
    expect(merged.baselineEmployments).toBeDefined();
    expect(merged.scenarios).toEqual([]);
    expect(provenance).toEqual(
      expect.arrayContaining([
        { field: 'household', source: 'profile' },
        { field: 'baselineEmployments', source: 'profile' },
      ])
    );
  });

  it('preserves explicit request input over profile hydration', () => {
    const explicitHousehold = { members: [{ id: 'a1', role: 'adult' as const }] };

    const { merged, provenance } = benefitsSimulatorMergeStrategy.merge({
      requestInput: { household: explicitHousehold },
      profile: sampleProfile,
    });

    expect(merged.household).toEqual(explicitHousehold);
    expect(provenance.find((p) => p.field === 'household')?.source).toBe('input');
    expect(merged.baselineEmployments).toEqual({ a1: { type: 'none' } });
    expect(provenance.find((p) => p.field === 'baselineEmployments')?.source).toBe(
      'profile'
    );
  });

  it('applies request overrides after profile merge', () => {
    const { merged } = benefitsSimulatorMergeStrategy.merge({
      requestInput: {},
      requestOverrides: { taxYear: 2024 },
      profile: sampleProfile,
    });

    expect(merged.taxYear).toBe(2024);
  });
});
