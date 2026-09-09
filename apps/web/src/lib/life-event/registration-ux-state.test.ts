import { describe, expect, it } from 'vitest';
import type { UserContextV1 } from '@/lib/product-contract';
import {
  deriveRegistrationUxState,
  doesExternalGuidanceCompleteRegistration,
} from './registration-ux-state.js';
import { ANMELDUNG_OFFICIAL_GUIDANCE_URL } from './anmeldung-guidance.js';

function context(partial: {
  city?: string;
  municipalRegistrationConfirmed?: boolean;
}): UserContextV1 {
  return {
    schemaVersion: '1.0.0',
    profile: {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 0, missingDomains: [] },
      domains: {
        housing: partial.city ? { city: partial.city } : undefined,
        migration:
          partial.municipalRegistrationConfirmed !== undefined
            ? { municipalRegistrationConfirmed: partial.municipalRegistrationConfirmed }
            : undefined,
      },
    },
  };
}

describe('PD-001 registration UX state', () => {
  it('is blocked without registrable address', () => {
    expect(deriveRegistrationUxState(context({})).state).toBe('blocked');
  });

  it('is actionable with address and no confirmation', () => {
    const snap = deriveRegistrationUxState(context({ city: 'Bremen' }));
    expect(snap.state).toBe('actionable');
    expect(snap.hasConfirmation).toBe(false);
  });

  it('is complete only with address and explicit confirmation', () => {
    const snap = deriveRegistrationUxState(
      context({ city: 'Bremen', municipalRegistrationConfirmed: true })
    );
    expect(snap.state).toBe('complete');
  });

  it('does not treat external guidance as completion', () => {
    expect(doesExternalGuidanceCompleteRegistration()).toBe(false);
    expect(ANMELDUNG_OFFICIAL_GUIDANCE_URL).toBeNull();
  });
});
