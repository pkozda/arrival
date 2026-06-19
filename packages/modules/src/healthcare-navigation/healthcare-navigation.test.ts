import { describe, it, expect } from 'vitest';
import type { AppContext } from '@arrival-atlas/core';
import {
  healthcareNavigationModule,
  resolveHealthcareNavigationLanguage,
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

describe('healthcareNavigationModule language resolution', () => {
  it('executes with profileSlice language without reading userProfile first', async () => {
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

    expect(resolveHealthcareNavigationLanguage({
      profileSlice: { preferredLanguage: 'ua' },
      userProfile: { language: 'de' },
    })).toBe('ua');
    expect(output.scenario).toContain('healthcare');
  });
});
