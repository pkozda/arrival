import { describe, expect, it } from 'vitest';
import {
  buildColdStartIntakeRequests,
  shouldShowLifeEventPlanIntake,
  validateColdStartIntakeDraft,
} from './cold-start-intake';

describe('cold-start-intake', () => {
  it('shows plan intake only for profile-less cold start outside simulation mode', () => {
    expect(
      shouldShowLifeEventPlanIntake({
        planLoading: false,
        hasPlan: false,
        hasProfile: false,
        scenariosMode: false,
      })
    ).toBe(true);

    expect(
      shouldShowLifeEventPlanIntake({
        planLoading: false,
        hasPlan: false,
        hasProfile: false,
        scenariosMode: true,
      })
    ).toBe(false);
  });

  it('builds profile mutation requests from intake draft', () => {
    const requests = buildColdStartIntakeRequests(
      {
        residencyStatus: 'work-visa',
        city: 'Berlin',
        employmentStatus: 'employed',
        insuranceType: 'public',
      },
      0
    );

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some((request) => request.domain === 'migration')).toBe(true);
    expect(requests.some((request) => request.domain === 'employment')).toBe(true);
    expect(
      requests.some(
        (request) =>
          request.domain === 'healthInsurance' &&
          request.payload.kind === 'domain_facts' &&
          request.payload.fields.hasCoverage === true
      )
    ).toBe(true);
  });

  it('requires core intake fields', () => {
    expect(validateColdStartIntakeDraft({})).toBe('residencyStatus');
    expect(
      validateColdStartIntakeDraft({
        residencyStatus: 'work-visa',
        employmentStatus: 'employed',
        insuranceType: 'none',
      })
    ).toBeNull();
  });
});
