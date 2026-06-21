import { z } from 'zod';

export const ECONOMIC_FEEDBACK_SIGNALS_SCHEMA_VERSION = '1.0.0';

export const EconomicFeedbackSignalsV1Schema = z.object({
  schemaVersion: z.literal(ECONOMIC_FEEDBACK_SIGNALS_SCHEMA_VERSION),
  employmentSignalDelta: z.number().min(0).max(1),
  institutionEngagementDelta: z.number().min(0).max(1),
  institutionEngagementTarget: z.enum(['none', 'jobcenter', 'sozialamt']).default('none'),
  crisisStabilityDelta: z.number().min(-1).max(1),
});

export type EconomicFeedbackSignalsV1 = z.infer<typeof EconomicFeedbackSignalsV1Schema>;

export const EMPTY_ECONOMIC_FEEDBACK_SIGNALS: EconomicFeedbackSignalsV1 = {
  schemaVersion: ECONOMIC_FEEDBACK_SIGNALS_SCHEMA_VERSION,
  employmentSignalDelta: 0,
  institutionEngagementDelta: 0,
  institutionEngagementTarget: 'none',
  crisisStabilityDelta: 0,
};

export function parseEconomicFeedbackSignalsV1(input: unknown): EconomicFeedbackSignalsV1 {
  return EconomicFeedbackSignalsV1Schema.parse(input);
}
