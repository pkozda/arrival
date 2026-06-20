import {
  getFieldsForDomain,
  PROFILE_DOMAINS,
  USER_PROFILE_VIEW_SCHEMA_VERSION,
  UserProfileViewV1Schema,
  type PersistentFactFieldId,
  type ProfileDomain,
  type SupportedLanguage,
  type UserProfileDomainViews,
  type UserProfileViewV1,
} from '@arrival-atlas/product-contract';
import type { ProfileState } from '../profile-state.js';

const FACT_DOMAINS = PROFILE_DOMAINS.filter((domain) => domain !== 'preferences');

function readField<T>(state: ProfileState, fieldId: PersistentFactFieldId): T | undefined {
  const entry = state.fields[fieldId];
  return entry?.value as T | undefined;
}

function buildDomainSlice<D extends keyof UserProfileDomainViews>(
  state: ProfileState,
  _domain: D,
  fieldIds: PersistentFactFieldId[]
): UserProfileDomainViews[D] | undefined {
  const slice: Record<string, unknown> = {};
  let hasValue = false;

  for (const fieldId of fieldIds) {
    const value = readField(state, fieldId);
    if (value !== undefined) {
      slice[fieldId] = value;
      hasValue = true;
    }
  }

  return hasValue ? (slice as UserProfileDomainViews[D]) : undefined;
}

function domainHasData(state: ProfileState, domain: ProfileDomain): boolean {
  return getFieldsForDomain(domain).some((field) => state.fields[field.id] !== undefined);
}

function computeCompleteness(state: ProfileState): UserProfileViewV1['completeness'] {
  const missingDomains = FACT_DOMAINS.filter((domain) => !domainHasData(state, domain));
  const completeCount = FACT_DOMAINS.length - missingDomains.length;
  const score =
    FACT_DOMAINS.length === 0 ? 0 : Math.round((completeCount / FACT_DOMAINS.length) * 100);

  return { score, missingDomains };
}

/** UI-safe projection — no event log, reducer metadata, or schema paths. */
export function projectProfileState(state: ProfileState): UserProfileViewV1 {
  const preferredLanguage =
    (readField<SupportedLanguage>(state, 'preferredLanguage') ?? 'en') as SupportedLanguage;

  const view: UserProfileViewV1 = {
    schemaVersion: USER_PROFILE_VIEW_SCHEMA_VERSION,
    preferences: {
      preferredLanguage,
      theme: readField(state, 'theme'),
      uiDensity: readField(state, 'uiDensity'),
    },
    completeness: computeCompleteness(state),
    domains: {
      migration: buildDomainSlice(state, 'migration', [
        'countryOfOrigin',
        'residencyStatus',
        'arrivedAt',
      ]),
      housing: buildDomainSlice(state, 'housing', [
        'bundesland',
        'city',
        'monthlyColdRent',
        'monthlyUtilities',
      ]),
      household: buildDomainSlice(state, 'household', [
        'householdSize',
        'maritalStatus',
        'children',
      ]),
      employment: buildDomainSlice(state, 'employment', [
        'employmentStatus',
        'taxClass',
        'churchTax',
      ]),
      income: buildDomainSlice(state, 'income', ['grossMonthlyIncome']),
      healthInsurance: buildDomainSlice(state, 'healthInsurance', [
        'insuranceType',
        'hasCoverage',
      ]),
      benefits: buildDomainSlice(state, 'benefits', [
        'receivingBuergergeld',
        'receivingAlg1',
        'receivingWohngeld',
        'daysInGermany',
      ]),
    },
  };

  return UserProfileViewV1Schema.parse(view);
}
