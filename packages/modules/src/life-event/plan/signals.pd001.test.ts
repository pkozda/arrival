import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import {
  computeSituationSignals,
  isSatisfactionMet,
} from './signals.js';

function context(partial: {
  city?: string;
  residencyStatus?: UserContextV1['profile'] extends infer P
    ? P extends { domains?: { migration?: { residencyStatus?: infer R } } }
      ? R
      : never
    : never;
  municipalRegistrationConfirmed?: boolean;
  daysInGermany?: number;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 0, missingDomains: [] },
      domains: {
        housing: partial.city ? { city: partial.city } : undefined,
        migration: {
          ...(partial.residencyStatus !== undefined
            ? { residencyStatus: partial.residencyStatus }
            : {}),
          ...(partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : {}),
        },
        benefits:
          partial.daysInGermany !== undefined
            ? { daysInGermany: partial.daysInGermany }
            : undefined,
      },
    },
  };
}

describe('PD-001 municipal registration confirmation', () => {
  it('does not mark municipal_registration satisfied from address + residency heuristic alone', () => {
    const signals = computeSituationSignals(
      context({
        city: 'Bremen',
        residencyStatus: 'temporary-resident',
        daysInGermany: 45,
      })
    );

    expect(signals.hasRegistrableAddress).toBe(true);
    expect(signals.isMunicipallyRegistered).toBe(true);
    expect(signals.hasMunicipalRegistrationConfirmation).toBe(false);
    expect(isSatisfactionMet('municipal_registration', signals)).toBe(false);
  });

  it('marks municipal_registration satisfied only with address + explicit confirmation', () => {
    const signals = computeSituationSignals(
      context({
        city: 'Bremen',
        residencyStatus: 'temporary-resident',
        daysInGermany: 45,
        municipalRegistrationConfirmed: true,
      })
    );

    expect(signals.hasRegistrableAddress).toBe(true);
    expect(signals.hasMunicipalRegistrationConfirmation).toBe(true);
    expect(isSatisfactionMet('municipal_registration', signals)).toBe(true);
  });

  it('does not mark municipal_registration satisfied with confirmation but no address', () => {
    const signals = computeSituationSignals(
      context({
        residencyStatus: 'temporary-resident',
        municipalRegistrationConfirmed: true,
        daysInGermany: 45,
      })
    );

    expect(signals.hasRegistrableAddress).toBe(false);
    expect(signals.hasMunicipalRegistrationConfirmation).toBe(true);
    expect(isSatisfactionMet('municipal_registration', signals)).toBe(false);
  });

  it('keeps registrable_address independent of confirmation', () => {
    const withCity = computeSituationSignals(context({ city: 'Berlin' }));
    expect(isSatisfactionMet('registrable_address', withCity)).toBe(true);
    expect(isSatisfactionMet('municipal_registration', withCity)).toBe(false);
  });
});
