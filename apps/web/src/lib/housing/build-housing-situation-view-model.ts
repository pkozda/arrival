/**
 * E9 — Housing Situation view model (derived, non-persisted).
 * Current housing situation ≠ registration confirmation ≠ housing search.
 */
import type { UserProfileViewV1 } from '@/lib/product-contract';

export type HousingSituationStateV1 = 'NOT_ADDED' | 'INCOMPLETE' | 'READY';

export type HousingSituationNextActionKindV1 =
  | 'update_housing'
  | 'confirm_registration'
  | 'review_housing'
  | 'none';

export type HousingSituationKnownFactV1 = {
  factId: 'city' | 'bundesland' | 'monthlyColdRent' | 'monthlyUtilities' | 'registration';
  presence: 'KNOWN' | 'UNKNOWN';
  labelKey: string;
  /** Display value key or literal city/rent for known facts — presentation resolves. */
  valueText?: string;
};

export type HousingSituationViewModelV1 = {
  state: HousingSituationStateV1;
  stateLabelKey: string;
  explanationKey: string;
  knownFacts: HousingSituationKnownFactV1[];
  missingFieldKeys: string[];
  nextAction: {
    kind: HousingSituationNextActionKindV1;
    href: string | null;
    labelKey: string;
  };
  /** Related administrative signal — not Housing completion. */
  registration: {
    hasRegistrableAddress: boolean;
    confirmed: boolean;
    statusKey: string;
  };
  disclaimerKey: string;
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Derive Housing Situation from authoritative profile facts.
 * Never treats missing rent as 0, missing city as homeless, or registration heuristic as confirmation.
 */
export function buildHousingSituationViewModel(
  profile: UserProfileViewV1 | null | undefined
): HousingSituationViewModelV1 {
  const housing = profile?.domains?.housing;
  const migration = profile?.domains?.migration;

  const city = hasText(housing?.city) ? housing.city.trim() : undefined;
  const bundesland = hasText(housing?.bundesland) ? housing.bundesland.trim() : undefined;
  const rentKnown = typeof housing?.monthlyColdRent === 'number';
  const utilitiesKnown = typeof housing?.monthlyUtilities === 'number';
  const registrationConfirmed = migration?.municipalRegistrationConfirmed === true;
  const hasRegistrableAddress = Boolean(city);

  const anyHousingFact = Boolean(city || bundesland || rentKnown || utilitiesKnown);

  const knownFacts: HousingSituationKnownFactV1[] = [
    {
      factId: 'city',
      presence: city ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'housing.situation.fact.city',
      valueText: city,
    },
    {
      factId: 'bundesland',
      presence: bundesland ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'housing.situation.fact.bundesland',
      valueText: bundesland,
    },
    {
      factId: 'monthlyColdRent',
      presence: rentKnown ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'housing.situation.fact.coldRent',
      valueText: rentKnown ? String(housing!.monthlyColdRent) : undefined,
    },
    {
      factId: 'monthlyUtilities',
      presence: utilitiesKnown ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'housing.situation.fact.utilities',
      valueText: utilitiesKnown ? String(housing!.monthlyUtilities) : undefined,
    },
    {
      factId: 'registration',
      presence: registrationConfirmed ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'housing.situation.fact.registration',
    },
  ];

  const missingFieldKeys: string[] = [];
  if (!city) missingFieldKeys.push('housing.situation.missing.city');
  if (!rentKnown) missingFieldKeys.push('housing.situation.missing.coldRent');

  const registrationStatusKey = !hasRegistrableAddress
    ? 'housing.situation.registration.needsAddress'
    : registrationConfirmed
      ? 'housing.situation.registration.confirmed'
      : 'housing.situation.registration.pending';

  const disclaimerKey = 'housing.situation.disclaimer';

  if (!anyHousingFact) {
    return {
      state: 'NOT_ADDED',
      stateLabelKey: 'housing.situation.state.NOT_ADDED',
      explanationKey: 'housing.situation.explanation.notAdded',
      knownFacts,
      missingFieldKeys,
      nextAction: {
        kind: 'update_housing',
        href: '/profile/where-you-live/edit',
        labelKey: 'housing.situation.action.updateHousing',
      },
      registration: {
        hasRegistrableAddress,
        confirmed: registrationConfirmed,
        statusKey: registrationStatusKey,
      },
      disclaimerKey,
    };
  }

  if (!city || !rentKnown) {
    return {
      state: 'INCOMPLETE',
      stateLabelKey: 'housing.situation.state.INCOMPLETE',
      explanationKey: 'housing.situation.explanation.incomplete',
      knownFacts,
      missingFieldKeys,
      nextAction: {
        kind: 'update_housing',
        href: '/profile/where-you-live/edit',
        labelKey: 'housing.situation.action.updateHousing',
      },
      registration: {
        hasRegistrableAddress,
        confirmed: registrationConfirmed,
        statusKey: registrationStatusKey,
      },
      disclaimerKey,
    };
  }

  // City + cold rent known — housing situation is usable for ER / Benefits.
  // Registration remains a related administrative signal, not Housing COMPLETED.
  if (hasRegistrableAddress && !registrationConfirmed) {
    return {
      state: 'READY',
      stateLabelKey: 'housing.situation.state.READY',
      explanationKey: 'housing.situation.explanation.readyPendingRegistration',
      knownFacts,
      missingFieldKeys: [],
      nextAction: {
        kind: 'confirm_registration',
        href: '/modules/life-event/prepare-anmeldung',
        labelKey: 'housing.situation.action.confirmRegistration',
      },
      registration: {
        hasRegistrableAddress,
        confirmed: registrationConfirmed,
        statusKey: registrationStatusKey,
      },
      disclaimerKey,
    };
  }

  return {
    state: 'READY',
    stateLabelKey: 'housing.situation.state.READY',
    explanationKey: 'housing.situation.explanation.ready',
    knownFacts,
    missingFieldKeys: [],
    nextAction: {
      kind: 'review_housing',
      href: '/profile/where-you-live/edit',
      labelKey: 'housing.situation.action.reviewHousing',
    },
    registration: {
      hasRegistrableAddress,
      confirmed: registrationConfirmed,
      statusKey: registrationStatusKey,
    },
    disclaimerKey,
  };
}
