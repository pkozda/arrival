import { describe, it, expect } from 'vitest';
import type { AppContext } from '@arrival-atlas/core';
import {
  deriveHealthcareInsuranceAssumption,
  evaluateHealthcareNavigation,
  healthcareNavigationModule,
  resolveHealthcareNavigationLanguage,
  resolveHealthcareOutcomeFromBody,
} from './index.js';

describe('resolveHealthcareNavigationLanguage', () => {
  it('Case A: prefers profileSlice.preferredLanguage over userProfile.language', () => {
    const context: AppContext = {
      profileSlice: { preferredLanguage: 'ua' },
      userProfile: { language: 'de' },
    };

    expect(resolveHealthcareNavigationLanguage(context)).toBe('ua');
  });

  it('Case B: falls back to userProfile.language when profileSlice is missing', () => {
    const context: AppContext = {
      userProfile: { language: 'de' },
    };

    expect(resolveHealthcareNavigationLanguage(context)).toBe('de');
  });

  it('Case C: defaults to en when both sources are missing', () => {
    expect(resolveHealthcareNavigationLanguage({})).toBe('en');
  });
});

describe('PD-003 healthcare progressive enrichment', () => {
  it('A — sufficient context produces RECOMMENDATIONS', () => {
    const result = evaluateHealthcareNavigation(
      {
        situation: 'need-doctor',
        hasInsurance: true,
        insuranceType: 'public',
        urgency: 'routine',
      },
      'en'
    );

    expect(result.outcome).toBe('RECOMMENDATIONS');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.insuranceAssumption).toBe('insured');
    expect(result.missing).toEqual([]);
  });

  it('B — insufficient context produces MORE_INFO_REQUIRED (not empty-success ambiguity)', () => {
    const result = evaluateHealthcareNavigation(
      {
        situation: 'need-doctor',
        urgency: 'routine',
      },
      'en'
    );

    expect(result.outcome).toBe('MORE_INFO_REQUIRED');
    expect(result.steps).toEqual([]);
    expect(result.missing.some((item) => item.field === 'insurance')).toBe(true);
    expect(result.insuranceAssumption).toBe('unknown');
  });

  it('C — unknown insurance stays distinguishable from insured/uninsured', () => {
    expect(deriveHealthcareInsuranceAssumption({})).toBe('unknown');
    expect(deriveHealthcareInsuranceAssumption({ hasInsurance: true })).toBe('insured');
    expect(deriveHealthcareInsuranceAssumption({ hasInsurance: false })).toBe('uninsured');
    expect(deriveHealthcareInsuranceAssumption({ insuranceType: 'public' })).toBe('insured');
    expect(deriveHealthcareInsuranceAssumption({ insuranceType: 'none' })).toBe('uninsured');
  });

  it('D — empty evaluated body becomes NO_APPLICABLE_RESULT', () => {
    const result = resolveHealthcareOutcomeFromBody(
      {
        scenario: 'Evaluated with no guidance',
        steps: [],
        decisions: [],
        warnings: [],
      },
      'insured'
    );

    expect(result.outcome).toBe('NO_APPLICABLE_RESULT');
    expect(result.steps).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('F — recommendation result remains representable for insured new-arrival', async () => {
    const output = await healthcareNavigationModule.execute(
      {
        situation: 'new-arrival',
        hasInsurance: false,
        insuranceType: 'none',
        urgency: 'routine',
      },
      {
        profileSlice: { preferredLanguage: 'ua' },
        userProfile: { language: 'de' },
      }
    );

    expect(output.outcome).toBe('RECOMMENDATIONS');
    expect(output.scenario.length).toBeGreaterThan(0);
    expect(output.steps.length).toBeGreaterThan(0);
    expect(output.insuranceAssumption).toBe('uninsured');
  });

  it('emergency can run without insurance facts', () => {
    const result = evaluateHealthcareNavigation(
      {
        situation: 'emergency',
        urgency: 'urgent',
      },
      'en'
    );

    expect(result.outcome).toBe('RECOMMENDATIONS');
    expect(result.insuranceAssumption).toBe('unknown');
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
