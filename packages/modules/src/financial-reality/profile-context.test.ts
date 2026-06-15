import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AppContext } from '@arrivalos/core';
import { resolveFinancialProfileContext } from './profile-context.js';

describe('resolveFinancialProfileContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads insurance and benefits from profileSlice first', () => {
    const context: AppContext = {
      profileId: 'prof_1',
      profileSlice: {
        preferredLanguage: 'de',
        insurance: { hasCoverage: true },
        benefits: { daysInGermany: 90 },
      },
    };

    const result = resolveFinancialProfileContext(context, {});

    expect(result.hasHealthInsurance).toBe(true);
    expect(result.daysInGermany).toBe(90);
  });

  it('falls back to merged input when profileSlice domains are absent', () => {
    const context: AppContext = {
      profileSlice: { preferredLanguage: 'en' },
    };

    const result = resolveFinancialProfileContext(context, {
      insurance: { hasCoverage: true },
      benefits: { daysInGermany: 30 },
    });

    expect(result.hasHealthInsurance).toBe(true);
    expect(result.daysInGermany).toBe(30);
  });

  it('uses neutral defaults when data is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveFinancialProfileContext({}, {});

    expect(result.hasHealthInsurance).toBe(false);
    expect(result.daysInGermany).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[FinancialReality] Missing insurance/benefits in profile context',
      expect.objectContaining({ availableKeys: [] })
    );
  });

  it('does not use optimistic insurance or zero-day defaults', () => {
    const result = resolveFinancialProfileContext(
      { profileSlice: { preferredLanguage: 'de' } },
      {}
    );

    expect(result.hasHealthInsurance).not.toBe(true);
    expect(result.daysInGermany).not.toBe(0);
  });
});
