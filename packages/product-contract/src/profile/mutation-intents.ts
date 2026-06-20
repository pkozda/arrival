import { z } from 'zod';

/**
 * Semantic intent vocabulary — independent from mutation source.
 * Example: source=profile_ui + intent=correction is valid.
 */
export const MUTATION_INTENTS = [
  'capture',
  'correction',
  'confirmation',
  'migration',
  'preference',
  'system',
] as const;

export const MutationIntentSchema = z.enum(MUTATION_INTENTS);

export type MutationIntent = z.infer<typeof MutationIntentSchema>;

export type MutationIntentRegistryEntry = {
  intent: MutationIntent;
  description: string;
};

export const MUTATION_INTENT_REGISTRY: Readonly<Record<MutationIntent, MutationIntentRegistryEntry>> = {
  capture: {
    intent: 'capture',
    description: 'User captured facts through a module decision flow',
  },
  correction: {
    intent: 'correction',
    description: 'User corrected stored facts from the situation mirror',
  },
  confirmation: {
    intent: 'confirmation',
    description: 'User confirmed a previously proposed change',
  },
  migration: {
    intent: 'migration',
    description: 'System migration or backfill of historical data',
  },
  preference: {
    intent: 'preference',
    description: 'Session or display preference change',
  },
  system: {
    intent: 'system',
    description: 'Automated system maintenance (staleness, sync)',
  },
};

/** Recommended intent for each mutation type (validation hint — not enforced at contract layer). */
export const MUTATION_TYPE_DEFAULT_INTENT: Partial<Record<string, MutationIntent>> = {
  'fact.create': 'capture',
  'fact.update': 'capture',
  'fact.correct': 'correction',
  'fact.invalidate': 'correction',
  'fact.suggest_correction': 'correction',
  'fact.propose_update': 'confirmation',
  'pref.update': 'preference',
};

export function isMutationIntent(value: unknown): value is MutationIntent {
  return MutationIntentSchema.safeParse(value).success;
}
