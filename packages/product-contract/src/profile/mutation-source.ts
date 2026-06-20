import { z } from 'zod';
import { ProfileDomainSchema } from './domains.js';

export const MutationSourceKindSchema = z.enum(['module', 'profile_ui', 'system', 'header']);

export type MutationSourceKind = z.infer<typeof MutationSourceKindSchema>;

export const SystemMutationReasonSchema = z.enum([
  'migration',
  'staleness_invalidate',
  'language_sync',
  'onboarding_progress',
]);

export type SystemMutationReason = z.infer<typeof SystemMutationReasonSchema>;

export const HeaderPrefFieldSchema = z.enum(['language', 'theme', 'uiDensity']);

export type HeaderPrefField = z.infer<typeof HeaderPrefFieldSchema>;

export type MutationSource =
  | { kind: 'module'; moduleId: string; executionId?: string }
  | { kind: 'profile_ui'; domain: z.infer<typeof ProfileDomainSchema> }
  | { kind: 'system'; reason: SystemMutationReason }
  | { kind: 'header'; prefField: HeaderPrefField };

export const MutationSourceSchema: z.ZodType<MutationSource> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('module'),
    moduleId: z.string().min(1),
    executionId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('profile_ui'),
    domain: ProfileDomainSchema,
  }),
  z.object({
    kind: z.literal('system'),
    reason: SystemMutationReasonSchema,
  }),
  z.object({
    kind: z.literal('header'),
    prefField: HeaderPrefFieldSchema,
  }),
]);

export type MutationSourceRegistryEntry = {
  kind: MutationSourceKind;
  mayInitiateFactMutations: boolean;
  mayInitiatePrefMutations: boolean;
};

export const MUTATION_SOURCE_REGISTRY: Readonly<Record<MutationSourceKind, MutationSourceRegistryEntry>> = {
  module: {
    kind: 'module',
    mayInitiateFactMutations: true,
    mayInitiatePrefMutations: false,
  },
  profile_ui: {
    kind: 'profile_ui',
    mayInitiateFactMutations: true,
    mayInitiatePrefMutations: true,
  },
  system: {
    kind: 'system',
    mayInitiateFactMutations: true,
    mayInitiatePrefMutations: true,
  },
  header: {
    kind: 'header',
    mayInitiateFactMutations: false,
    mayInitiatePrefMutations: true,
  },
};
