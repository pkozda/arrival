import { z } from 'zod';
import { ProfileDomainSchema } from './domains.js';

export const PROFILE_INSIGHT_VIEW_SCHEMA_VERSION = '1.0.0';

export const ProfileInsightViewSchemaVersionSchema = z.literal(PROFILE_INSIGHT_VIEW_SCHEMA_VERSION);

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low', 'none']);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const DomainConfidenceSchema = z.object({
  level: ConfidenceLevelSchema,
  reasons: z.array(z.string()),
});

export type DomainConfidence = z.infer<typeof DomainConfidenceSchema>;

export const ProfileMirrorDomainSlugSchema = z.enum([
  'move-to-germany',
  'where-you-live',
  'household-family',
  'work-income',
  'health-insurance',
  'benefits-support',
  'language-display',
]);

export type ProfileMirrorDomainSlug = z.infer<typeof ProfileMirrorDomainSlugSchema>;

export const AdvisorySuggestionActionSchema = z.enum(['open_module', 'correct_in_profile']);

export type AdvisorySuggestionAction = z.infer<typeof AdvisorySuggestionActionSchema>;

export const AdvisorySuggestionSchema = z.object({
  message: z.string(),
  action: AdvisorySuggestionActionSchema,
  href: z.string(),
});

export type AdvisorySuggestion = z.infer<typeof AdvisorySuggestionSchema>;

export const MissingContextHintSchema = z.object({
  domain: ProfileDomainSchema,
  mirrorSlug: ProfileMirrorDomainSlugSchema.optional(),
  message: z.string(),
  suggestedAction: AdvisorySuggestionActionSchema,
  ctaModuleId: z.string().optional(),
  href: z.string(),
});

export type MissingContextHint = z.infer<typeof MissingContextHintSchema>;

export const DomainInsightSchema = z.object({
  domain: ProfileDomainSchema,
  mirrorSlug: ProfileMirrorDomainSlugSchema,
  confidence: DomainConfidenceSchema,
  provenanceNarrative: z.string().optional(),
  suggestions: z.array(AdvisorySuggestionSchema),
});

export type DomainInsight = z.infer<typeof DomainInsightSchema>;

/**
 * Read-only interpretation projection — NOT authoritative for situation facts.
 * Derived from UserContextV1 + server-side metadata. Never written back to mutation log.
 */
export const ProfileInsightViewV1Schema = z.object({
  schemaVersion: ProfileInsightViewSchemaVersionSchema,
  generatedAt: z.string().datetime(),
  globalConfidence: z.enum(['high', 'medium', 'low']),
  missingContext: z.array(MissingContextHintSchema),
  domainInsights: z.array(DomainInsightSchema),
});

export type ProfileInsightViewV1 = z.infer<typeof ProfileInsightViewV1Schema>;

export function parseProfileInsightViewV1(input: unknown): ProfileInsightViewV1 {
  return ProfileInsightViewV1Schema.parse(input);
}

export function safeParseProfileInsightViewV1(input: unknown) {
  return ProfileInsightViewV1Schema.safeParse(input);
}
