import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { evaluateEconomicSatisfactionKeys } from './satisfaction-keys.js';

function context(partial: {
  city?: string;
  municipalRegistrationConfirmed?: boolean;
  residencyStatus?: 'temporary-resident' | 'tourist';
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
          ...(partial.residencyStatus
            ? { residencyStatus: partial.residencyStatus }
            : { residencyStatus: 'temporary-resident' }),
          ...(partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : {}),
        },
        benefits: { daysInGermany: partial.daysInGermany ?? 45 },
      },
    },
  };
}

describe('PD-001 registration_confirmed satisfaction', () => {
  it('stays false when heuristic would look registered but confirmation is absent', () => {
    const snapshot = evaluateEconomicSatisfactionKeys(
      context({ city: 'Bremen', residencyStatus: 'temporary-resident' })
    );
    expect(snapshot.registration_confirmed).toBe(false);
    expect(snapshot.registrable_address).toBe(true);
  });

  it('becomes true with address + explicit confirmation', () => {
    const snapshot = evaluateEconomicSatisfactionKeys(
      context({
        city: 'Bremen',
        municipalRegistrationConfirmed: true,
        residencyStatus: 'temporary-resident',
      })
    );
    expect(snapshot.registration_confirmed).toBe(true);
    expect(snapshot.registrable_address).toBe(true);
  });

  it('registrable_address is false when city is absent', () => {
    const snapshot = evaluateEconomicSatisfactionKeys(
      context({ residencyStatus: 'temporary-resident' })
    );
    expect(snapshot.registrable_address).toBe(false);
    expect(snapshot.registration_confirmed).toBe(false);
  });
});
