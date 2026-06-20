import { z } from 'zod';
import { SupportedLanguageSchema, ThemePreferenceSchema } from '../ui/index.js';
import { ProfileDomainSchema } from './domains.js';
import {
  BenefitsDomainFieldsSchema,
  EmploymentDomainFieldsSchema,
  HealthInsuranceDomainFieldsSchema,
  HouseholdDomainFieldsSchema,
  HousingDomainFieldsSchema,
  IncomeDomainFieldsSchema,
  MigrationDomainFieldsSchema,
} from './domain-field-types.js';

export const USER_PROFILE_VIEW_SCHEMA_VERSION = '1.0.0';

export const UserProfileViewSchemaVersionSchema = z.literal(USER_PROFILE_VIEW_SCHEMA_VERSION);

export const ProfileCompletenessSchema = z.object({
  score: z.number().int().min(0).max(100),
  missingDomains: z.array(ProfileDomainSchema),
});

export type ProfileCompleteness = z.infer<typeof ProfileCompletenessSchema>;

/** UI-safe domain projections — product field IDs only, no schema paths or event log. */
export const UserProfileDomainViewsSchema = z.object({
  migration: MigrationDomainFieldsSchema.optional(),
  housing: HousingDomainFieldsSchema.optional(),
  household: HouseholdDomainFieldsSchema.optional(),
  employment: EmploymentDomainFieldsSchema.optional(),
  income: IncomeDomainFieldsSchema.optional(),
  healthInsurance: HealthInsuranceDomainFieldsSchema.optional(),
  benefits: BenefitsDomainFieldsSchema.optional(),
});

export type UserProfileDomainViews = z.infer<typeof UserProfileDomainViewsSchema>;

export const UserProfilePreferencesViewSchema = z.object({
  preferredLanguage: SupportedLanguageSchema,
  theme: ThemePreferenceSchema.optional(),
  uiDensity: z.enum(['comfortable', 'compact']).optional(),
});

export type UserProfilePreferencesView = z.infer<typeof UserProfilePreferencesViewSchema>;

export const UserProfileViewV1Schema = z.object({
  schemaVersion: UserProfileViewSchemaVersionSchema,
  preferences: UserProfilePreferencesViewSchema,
  completeness: ProfileCompletenessSchema,
  domains: UserProfileDomainViewsSchema,
});

/**
 * Contract-facing UI projection of profile state.
 * No schema paths, raw event log, reducer internals, or engine policy documents.
 */
export type UserProfileViewV1 = z.infer<typeof UserProfileViewV1Schema>;

export function parseUserProfileViewV1(input: unknown): UserProfileViewV1 {
  return UserProfileViewV1Schema.parse(input);
}

export function safeParseUserProfileViewV1(input: unknown) {
  return UserProfileViewV1Schema.safeParse(input);
}

/** Aggregated user context shell — profile view is optional until first fact exists. */
export const UserContextV1Schema = z.object({
  profile: UserProfileViewV1Schema.nullable(),
});

export type UserContextV1 = z.infer<typeof UserContextV1Schema>;

export function parseUserContextV1(input: unknown): UserContextV1 {
  return UserContextV1Schema.parse(input);
}
