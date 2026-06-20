import { z } from 'zod';
import { ProfileDomainSchema } from './domains.js';
import { MutationRequestPayloadSchema } from './domain-field-types.js';
import { PersistentFactFieldIdSchema } from './field-registry.js';
import { MutationIntentSchema } from './mutation-intents.js';
import { MutationSourceSchema } from './mutation-source.js';
import { MutationTypeSchema } from './mutation-types.js';

export const FieldDeltaOperationSchema = z.enum(['set', 'clear']);

export type FieldDeltaOperation = z.infer<typeof FieldDeltaOperationSchema>;

export const FieldDeltaSchema = z.object({
  fieldId: PersistentFactFieldIdSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  operation: FieldDeltaOperationSchema,
});

export type FieldDelta = z.infer<typeof FieldDeltaSchema>;

export const MutationEventSchema = z.object({
  eventId: z.string().min(1),
  /** Links to MutationRequest.requestId for idempotency tracing */
  mutationId: z.string().min(1),
  profileId: z.string().min(1),
  sequence: z.number().int().positive(),
  revision: z.number().int().positive(),
  timestamp: z.string().datetime(),
  committedAt: z.string().datetime(),
  type: MutationTypeSchema,
  intent: MutationIntentSchema,
  domain: ProfileDomainSchema.nullable(),
  payload: MutationRequestPayloadSchema,
  fieldDeltas: z.array(FieldDeltaSchema),
  source: MutationSourceSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export type MutationEvent = z.infer<typeof MutationEventSchema>;

export type MutationEventLog = {
  profileId: string;
  events: readonly MutationEvent[];
  headRevision: number;
};

export const MutationEventLogSchema = z.object({
  profileId: z.string().min(1),
  events: z.array(MutationEventSchema),
  headRevision: z.number().int().nonnegative(),
});

export function parseMutationEvent(input: unknown): MutationEvent {
  return MutationEventSchema.parse(input);
}

export function safeParseMutationEvent(input: unknown) {
  return MutationEventSchema.safeParse(input);
}
