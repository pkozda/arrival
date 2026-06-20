import { z } from 'zod';
import { ProfileDomainSchema } from './domains.js';
import { PersistentFactFieldIdSchema } from './field-registry.js';
import { MutationSourceSchema } from './mutation-source.js';
import { MutationTypeSchema } from './mutation-types.js';

export const ProfileRevisionFieldChangeSchema = z.object({
  fieldId: PersistentFactFieldIdSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
});

export type ProfileRevisionFieldChange = z.infer<typeof ProfileRevisionFieldChangeSchema>;

export const ProfileRevisionSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  revision: z.number().int().positive(),
  mutationId: z.string().min(1),
  eventId: z.string().min(1),
  domain: ProfileDomainSchema.nullable(),
  mutationType: MutationTypeSchema,
  changes: z.array(ProfileRevisionFieldChangeSchema),
  source: MutationSourceSchema,
  reason: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type ProfileRevision = z.infer<typeof ProfileRevisionSchema>;

export function parseProfileRevision(input: unknown): ProfileRevision {
  return ProfileRevisionSchema.parse(input);
}

export function safeParseProfileRevision(input: unknown) {
  return ProfileRevisionSchema.safeParse(input);
}
