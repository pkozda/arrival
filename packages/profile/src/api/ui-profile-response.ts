/**
 * Public UI contract types for profile CRUD endpoints.
 * Intentionally separate from internal engine types (ProfileRecord, ProfileSlice, etc.).
 */

export interface UIProfileLocation {
  bundesland?: string;
  city?: string;
}

export interface UIProfileResidency {
  status?: string;
  arrivedAt?: string;
}

export interface UIProfileHousehold {
  size?: number;
  maritalStatus?: string;
  children?: Array<{ age: number }>;
}

export interface UIProfileEmployment {
  status?: string;
  grossMonthlyIncome?: number;
  taxClass?: number;
  churchTax?: boolean;
}

export interface UIProfileHousing {
  monthlyColdRent?: number;
  monthlyUtilities?: number;
}

export interface UIProfileInsurance {
  type?: string;
  hasCoverage?: boolean;
}

export interface UIProfileBenefits {
  receivingBuergergeld?: boolean;
  receivingAlg1?: boolean;
  receivingWohngeld?: boolean;
  daysInGermany?: number;
}

/** Full profile document exposed to the UI (never policy-filtered). */
export interface UIProfileDocument {
  schemaVersion: string;
  preferredLanguage: string;
  countryOfOrigin?: string;
  location?: UIProfileLocation;
  residency?: UIProfileResidency;
  household?: UIProfileHousehold;
  employment?: UIProfileEmployment;
  housing?: UIProfileHousing;
  insurance?: UIProfileInsurance;
  benefits?: UIProfileBenefits;
  extensions?: Record<string, Record<string, unknown>>;
}

/** Stable response shape for GET/PATCH /api/profile. */
export interface UIProfileResponse {
  profile: UIProfileDocument;
  version: number;
  schemaVersion: string;
}

/** Internal engine record shape accepted by the mapper (structural only). */
export interface ProfileRecordForUI {
  revision: number;
  document: {
    schemaVersion: string;
    preferredLanguage: string;
    countryOfOrigin?: string;
    location?: UIProfileLocation;
    residency?: UIProfileResidency;
    household?: UIProfileHousehold;
    employment?: UIProfileEmployment;
    housing?: UIProfileHousing;
    insurance?: UIProfileInsurance;
    benefits?: UIProfileBenefits;
    extensions?: Record<string, Record<string, unknown>>;
  };
}

export function toUIProfileDocument(
  document: ProfileRecordForUI['document']
): UIProfileDocument {
  return structuredClone({
    schemaVersion: document.schemaVersion,
    preferredLanguage: document.preferredLanguage,
    ...(document.countryOfOrigin !== undefined
      ? { countryOfOrigin: document.countryOfOrigin }
      : {}),
    ...(document.location !== undefined ? { location: document.location } : {}),
    ...(document.residency !== undefined ? { residency: document.residency } : {}),
    ...(document.household !== undefined ? { household: document.household } : {}),
    ...(document.employment !== undefined ? { employment: document.employment } : {}),
    ...(document.housing !== undefined ? { housing: document.housing } : {}),
    ...(document.insurance !== undefined ? { insurance: document.insurance } : {}),
    ...(document.benefits !== undefined ? { benefits: document.benefits } : {}),
    ...(document.extensions !== undefined ? { extensions: document.extensions } : {}),
  });
}

export function toUIProfileResponse(record: ProfileRecordForUI): UIProfileResponse {
  return {
    profile: toUIProfileDocument(record.document),
    version: record.revision,
    schemaVersion: record.document.schemaVersion,
  };
}

/** Keys that must never appear on UI profile endpoint responses. */
export const UI_PROFILE_FORBIDDEN_RESPONSE_KEYS = [
  'trace',
  'steps',
  'policy',
  'policyId',
  'policyDocument',
  'mergedInput',
  'context',
  'profileSlice',
  'dataProvenance',
  'profileId',
  'revision',
  'inputProvenance',
  'moduleId',
] as const;
