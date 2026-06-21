import { z } from 'zod';
import { EconomicGraphIdSchema } from './graph-context.js';

export const ECONOMIC_PRESENTATION_SCHEMA_VERSION = '1.0.0';

export const EconomicPresentationSchemaVersionSchema = z.literal(
  ECONOMIC_PRESENTATION_SCHEMA_VERSION
);

export const PresentationSectionTypeSchema = z.enum(['PRIMARY', 'SECONDARY', 'SYSTEM']);

export type PresentationSectionType = z.infer<typeof PresentationSectionTypeSchema>;

export const PresentationUiTypeSchema = z.enum([
  'ACTION_CARD',
  'INTENT_CARD',
  'RESOURCE_CARD',
  'PROFILE_CARD',
]);

export type PresentationUiType = z.infer<typeof PresentationUiTypeSchema>;

export const PresentationSeveritySchema = z.enum(['high', 'medium', 'low']);

export type PresentationSeverity = z.infer<typeof PresentationSeveritySchema>;

export const PresentationSourceTrackSchema = z.enum(['primary', 'secondary', 'system']);

export type PresentationSourceTrack = z.infer<typeof PresentationSourceTrackSchema>;

export const UiStrategySchema = z.enum(['CRISIS_UI', 'INSTITUTION_UI', 'PROGRESSION_UI']);

export type UiStrategy = z.infer<typeof UiStrategySchema>;

export const PresentationCardV1Schema = z.object({
  cardId: z.string().min(1),
  titleKey: z.string().min(1),
  actionRefIds: z.array(z.string()).min(1),
  uiType: PresentationUiTypeSchema,
  severity: PresentationSeveritySchema.optional(),
  sourceTrack: PresentationSourceTrackSchema,
});

export type PresentationCardV1 = z.infer<typeof PresentationCardV1Schema>;

export const PresentationSectionV1Schema = z.object({
  sectionId: z.string().min(1),
  titleKey: z.string().min(1),
  type: PresentationSectionTypeSchema,
  cards: z.array(PresentationCardV1Schema),
  priority: z.number().min(0).max(100),
});

export type PresentationSectionV1 = z.infer<typeof PresentationSectionV1Schema>;

export const PresentationFocusV1Schema = z.object({
  labelKey: z.string().min(1),
  dominantActionRefIds: z.array(z.string()).min(1),
});

export type PresentationFocusV1 = z.infer<typeof PresentationFocusV1Schema>;

export const EconomicPresentationMetadataSchema = z.object({
  generatedFromPlanId: z.string().min(1),
});

export type EconomicPresentationMetadata = z.infer<typeof EconomicPresentationMetadataSchema>;

export const EconomicPresentationV1Schema = z.object({
  schemaVersion: EconomicPresentationSchemaVersionSchema,
  presentationId: z.string().min(1),
  graphId: EconomicGraphIdSchema,
  sections: z.array(PresentationSectionV1Schema).min(1),
  primaryHighlight: PresentationFocusV1Schema,
  systemHighlights: z.array(PresentationFocusV1Schema),
  uiStrategy: UiStrategySchema,
  metadata: EconomicPresentationMetadataSchema,
});

export type EconomicPresentationV1 = z.infer<typeof EconomicPresentationV1Schema>;

export function parseEconomicPresentationV1(input: unknown): EconomicPresentationV1 {
  return EconomicPresentationV1Schema.parse(input);
}

export function safeParseEconomicPresentationV1(input: unknown) {
  return EconomicPresentationV1Schema.safeParse(input);
}
