import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@/lib/product-contract';
import { buildHousingSituationViewModel } from './build-housing-situation-view-model';

function baseProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 0, missingDomains: [] },
    domains: {
      ...overrides,
    },
  } as UserProfileViewV1;
}

describe('E9 Housing Situation view model', () => {
  it('A — NOT_ADDED when no housing facts', () => {
    const vm = buildHousingSituationViewModel(baseProfile({}));
    expect(vm.state).toBe('NOT_ADDED');
    expect(vm.missingFieldKeys).toContain('housing.situation.missing.city');
    expect(vm.missingFieldKeys).toContain('housing.situation.missing.coldRent');
    expect(vm.nextAction.href).toContain('where-you-live');
    expect(vm.registration.confirmed).toBe(false);
  });

  it('does not treat missing rent as zero or household size as housing', () => {
    const vm = buildHousingSituationViewModel(
      baseProfile({ household: { householdSize: 3 } })
    );
    expect(vm.state).toBe('NOT_ADDED');
    expect(vm.knownFacts.find((f) => f.factId === 'monthlyColdRent')?.presence).toBe('UNKNOWN');
  });

  it('B — INCOMPLETE when city known but rent missing', () => {
    const vm = buildHousingSituationViewModel(
      baseProfile({ housing: { city: 'Berlin' } })
    );
    expect(vm.state).toBe('INCOMPLETE');
    expect(vm.registration.hasRegistrableAddress).toBe(true);
    expect(vm.missingFieldKeys).toContain('housing.situation.missing.coldRent');
    expect(vm.nextAction.kind).toBe('update_housing');
  });

  it('INCOMPLETE when rent known but city missing', () => {
    const vm = buildHousingSituationViewModel(
      baseProfile({ housing: { monthlyColdRent: 650 } })
    );
    expect(vm.state).toBe('INCOMPLETE');
    expect(vm.registration.hasRegistrableAddress).toBe(false);
    expect(vm.missingFieldKeys).toContain('housing.situation.missing.city');
  });

  it('C/D — READY when city + cold rent known', () => {
    const vm = buildHousingSituationViewModel(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 650, bundesland: 'BE' },
      })
    );
    expect(vm.state).toBe('READY');
    expect(vm.missingFieldKeys).toHaveLength(0);
    expect(vm.nextAction.kind).toBe('confirm_registration');
    expect(vm.nextAction.href).toContain('prepare-anmeldung');
  });

  it('F — Registration: confirmation is authoritative, not inferred from city', () => {
    const without = buildHousingSituationViewModel(
      baseProfile({ housing: { city: 'Berlin', monthlyColdRent: 700 } })
    );
    expect(without.registration.confirmed).toBe(false);
    expect(without.registration.statusKey).toBe('housing.situation.registration.pending');

    const withConfirm = buildHousingSituationViewModel(
      baseProfile({
        housing: { city: 'Berlin', monthlyColdRent: 700 },
        migration: { municipalRegistrationConfirmed: true },
      })
    );
    expect(withConfirm.registration.confirmed).toBe(true);
    expect(withConfirm.nextAction.kind).toBe('review_housing');
    expect(withConfirm.explanationKey).toBe('housing.situation.explanation.ready');
  });

  it('I — persistence: same facts reconstruct same derived state', () => {
    const profile = baseProfile({
      housing: { city: 'Hamburg', monthlyColdRent: 900 },
      migration: { municipalRegistrationConfirmed: true },
    });
    expect(buildHousingSituationViewModel(profile)).toEqual(
      buildHousingSituationViewModel(structuredClone(profile))
    );
  });

  it('utilities optional — do not block READY', () => {
    const vm = buildHousingSituationViewModel(
      baseProfile({
        housing: { city: 'Cologne', monthlyColdRent: 800 },
        migration: { municipalRegistrationConfirmed: true },
      })
    );
    expect(vm.state).toBe('READY');
    expect(vm.knownFacts.find((f) => f.factId === 'monthlyUtilities')?.presence).toBe('UNKNOWN');
  });
});
