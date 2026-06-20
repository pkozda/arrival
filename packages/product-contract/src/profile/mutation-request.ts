import { z } from 'zod';
import { ProfileDomainSchema } from './domains.js';
import { MutationRequestPayloadSchema } from './domain-field-types.js';
import { MutationIntentSchema } from './mutation-intents.js';
import { MutationSourceSchema } from './mutation-source.js';
import { MutationTypeSchema } from './mutation-types.js';

export const MutationRequestSchema = z.object({
  /** Client tracking identifier (may equal requestId) */
  id: z.string().min(1),
  /** Idempotency key — duplicate submissions must return same committed event */
  requestId: z.string().min(1),
  timestamp: z.string().datetime(),
  type: MutationTypeSchema,
  intent: MutationIntentSchema,
  domain: ProfileDomainSchema.nullable(),
  source: MutationSourceSchema,
  payload: MutationRequestPayloadSchema,
  confidence: z.number().min(0).max(1),
  userConfirmationRequired: z.boolean(),
  expectedHeadRevision: z.number().int().nonnegative().optional(),
  confirmsProposalId: z.string().min(1).optional(),
});

export type MutationRequest = z.infer<typeof MutationRequestSchema>;

/** Parsed + validated mutation request (output of schema parse). */
export type ValidatedMutationRequest = MutationRequest;

export function parseMutationRequest(input: unknown): ValidatedMutationRequest {
  return MutationRequestSchema.parse(input);
}

export function safeParseMutationRequest(input: unknown) {
  return MutationRequestSchema.safeParse(input);
}
