import { z } from 'zod';
import {
  EconomicActionTypeSchema,
  EconomicSystemIntentSchema,
} from '../profile/economic-action-set.js';

export const ECONOMIC_REALITY_EVENT_SCHEMA_VERSION = '1.0.0';

export const EconomicRealityEventTypeSchema = z.enum([
  'ACTION_EXECUTED',
  'MODULE_ENTERED',
  'INTENT_TRIGGERED',
  'ACTION_FAILED',
]);

export type EconomicRealityEventType = z.infer<typeof EconomicRealityEventTypeSchema>;

export const EconomicRealityEventV1Schema = z.object({
  schemaVersion: z.literal(ECONOMIC_REALITY_EVENT_SCHEMA_VERSION),
  type: EconomicRealityEventTypeSchema,
  actionId: z.string().min(1).optional(),
  moduleId: z.string().min(1).optional(),
  actionType: EconomicActionTypeSchema.optional(),
  profileKey: z.string().min(1).optional(),
  systemIntent: EconomicSystemIntentSchema.optional(),
  contextHash: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
});

export type EconomicRealityEventV1 = z.infer<typeof EconomicRealityEventV1Schema>;

export function parseEconomicRealityEventV1(input: unknown): EconomicRealityEventV1 {
  return EconomicRealityEventV1Schema.parse(input);
}
