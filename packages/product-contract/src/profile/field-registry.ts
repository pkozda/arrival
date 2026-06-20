import { z } from 'zod';
import type { ProfileDomain } from './domains.js';
import { SCENARIO_FIELD_IDS } from './scenario-fields.js';

export const FieldSensitivitySchema = z.enum(['low', 'medium', 'high']);

export type FieldSensitivity = z.infer<typeof FieldSensitivitySchema>;

/** Product-facing persistent fact field identifiers (never schema paths). */
export const PERSISTENT_FACT_FIELD_IDS = [
  'countryOfOrigin',
  'residencyStatus',
  'arrivedAt',
  'bundesland',
  'city',
  'monthlyColdRent',
  'monthlyUtilities',
  'householdSize',
  'maritalStatus',
  'children',
  'employmentStatus',
  'taxClass',
  'churchTax',
  'grossMonthlyIncome',
  'insuranceType',
  'hasCoverage',
  'receivingBuergergeld',
  'receivingAlg1',
  'receivingWohngeld',
  'daysInGermany',
  'preferredLanguage',
  'theme',
  'uiDensity',
] as const;

export const PersistentFactFieldIdSchema = z.enum(PERSISTENT_FACT_FIELD_IDS);

export type PersistentFactFieldId = z.infer<typeof PersistentFactFieldIdSchema>;

export type PersistentFactFieldDefinition = {
  id: PersistentFactFieldId;
  domain: ProfileDomain;
  sensitivity: FieldSensitivity;
  confirmationRequired: boolean;
  /** Whether field may appear in UserProfileViewV1 domain projection */
  exposedInProfileView: boolean;
};

export const PERSISTENT_FACT_FIELD_REGISTRY: Readonly<
  Record<PersistentFactFieldId, PersistentFactFieldDefinition>
> = {
  countryOfOrigin: {
    id: 'countryOfOrigin',
    domain: 'migration',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  residencyStatus: {
    id: 'residencyStatus',
    domain: 'migration',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  arrivedAt: {
    id: 'arrivedAt',
    domain: 'migration',
    sensitivity: 'low',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  bundesland: {
    id: 'bundesland',
    domain: 'housing',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  city: {
    id: 'city',
    domain: 'housing',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  monthlyColdRent: {
    id: 'monthlyColdRent',
    domain: 'housing',
    sensitivity: 'high',
    confirmationRequired: true,
    exposedInProfileView: true,
  },
  monthlyUtilities: {
    id: 'monthlyUtilities',
    domain: 'housing',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  householdSize: {
    id: 'householdSize',
    domain: 'household',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  maritalStatus: {
    id: 'maritalStatus',
    domain: 'household',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  children: {
    id: 'children',
    domain: 'household',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  employmentStatus: {
    id: 'employmentStatus',
    domain: 'employment',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  taxClass: {
    id: 'taxClass',
    domain: 'employment',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  churchTax: {
    id: 'churchTax',
    domain: 'employment',
    sensitivity: 'low',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  grossMonthlyIncome: {
    id: 'grossMonthlyIncome',
    domain: 'income',
    sensitivity: 'high',
    confirmationRequired: true,
    exposedInProfileView: true,
  },
  insuranceType: {
    id: 'insuranceType',
    domain: 'healthInsurance',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  hasCoverage: {
    id: 'hasCoverage',
    domain: 'healthInsurance',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  receivingBuergergeld: {
    id: 'receivingBuergergeld',
    domain: 'benefits',
    sensitivity: 'high',
    confirmationRequired: true,
    exposedInProfileView: true,
  },
  receivingAlg1: {
    id: 'receivingAlg1',
    domain: 'benefits',
    sensitivity: 'high',
    confirmationRequired: true,
    exposedInProfileView: true,
  },
  receivingWohngeld: {
    id: 'receivingWohngeld',
    domain: 'benefits',
    sensitivity: 'high',
    confirmationRequired: true,
    exposedInProfileView: true,
  },
  daysInGermany: {
    id: 'daysInGermany',
    domain: 'benefits',
    sensitivity: 'medium',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  preferredLanguage: {
    id: 'preferredLanguage',
    domain: 'preferences',
    sensitivity: 'low',
    confirmationRequired: false,
    exposedInProfileView: true,
  },
  theme: {
    id: 'theme',
    domain: 'preferences',
    sensitivity: 'low',
    confirmationRequired: false,
    exposedInProfileView: false,
  },
  uiDensity: {
    id: 'uiDensity',
    domain: 'preferences',
    sensitivity: 'low',
    confirmationRequired: false,
    exposedInProfileView: false,
  },
};

export function isPersistentFactFieldId(value: unknown): value is PersistentFactFieldId {
  return PersistentFactFieldIdSchema.safeParse(value).success;
}

export function getFieldDefinition(fieldId: PersistentFactFieldId): PersistentFactFieldDefinition {
  return PERSISTENT_FACT_FIELD_REGISTRY[fieldId];
}

export function getFieldsForDomain(domain: ProfileDomain): PersistentFactFieldDefinition[] {
  return Object.values(PERSISTENT_FACT_FIELD_REGISTRY).filter((field) => field.domain === domain);
}

/** Compile-time exhaustiveness: scenario IDs must not overlap persistent IDs. */
type ScenarioPersistentOverlap = Extract<PersistentFactFieldId, (typeof SCENARIO_FIELD_IDS)[number]>;
type AssertNoScenarioOverlap = ScenarioPersistentOverlap extends never ? true : never;
const _assertNoScenarioOverlap: AssertNoScenarioOverlap = true;
void _assertNoScenarioOverlap;
