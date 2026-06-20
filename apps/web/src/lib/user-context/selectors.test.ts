import { describe, expect, it } from 'vitest';
import { selectUserContextProfile, hasUserContextProfile, selectAppDisplayLanguage } from './selectors.js';
import type { UserContextV1 } from '@/lib/product-contract';

describe('user-context selectors', () => {
  it('selectUserContextProfile returns profile from UserContextV1', () => {
    const context: UserContextV1 = {
      profile: {
        schemaVersion: '1.0.0',
        preferences: { preferredLanguage: 'en' },
        completeness: { score: 10, missingDomains: [] },
        domains: { income: { grossMonthlyIncome: 2500 } },
      },
    };

    expect(selectUserContextProfile(context)?.domains.income?.grossMonthlyIncome).toBe(2500);
    expect(hasUserContextProfile(context)).toBe(true);
  });

  it('returns null when user context has no profile', () => {
    expect(selectUserContextProfile({ profile: null })).toBeNull();
    expect(hasUserContextProfile({ profile: null })).toBe(false);
  });

  it('selectAppDisplayLanguage prefers profile language over session language', () => {
    const context: UserContextV1 = {
      profile: {
        schemaVersion: '1.0.0',
        preferences: { preferredLanguage: 'de' },
        completeness: { score: 0, missingDomains: [] },
        domains: {},
      },
    };

    expect(selectAppDisplayLanguage(context, 'en')).toBe('de');
    expect(selectAppDisplayLanguage(null, 'de')).toBe('de');
    expect(selectAppDisplayLanguage(null, undefined)).toBe('en');
  });
});
