import type { MutationType } from '@arrival-atlas/product-contract';

/**
 * Precedence ladder from profile-mutation-model-v1 §4.2.
 * Higher number wins when comparing mutation classes.
 */
export const MUTATION_PRECEDENCE: Readonly<Record<string, number>> = {
  'fact.correct': 4,
  'fact.invalidate': 3,
  'fact.update': 2,
  'pref.update': 2,
  'fact.create': 1,
  migration_backfill: 0,
};

export function getMutationPrecedence(type: MutationType, intent?: string): number {
  if (intent === 'migration') {
    return MUTATION_PRECEDENCE.migration_backfill;
  }

  return MUTATION_PRECEDENCE[type] ?? -1;
}

/**
 * Compare two committed mutations for the same field.
 * Returns positive if `incoming` should supersede `incumbent` by class+sequence rules.
 */
export function incomingMutationSupersedesIncumbent(params: {
  incomingType: MutationType;
  incomingSequence: number;
  incomingIntent?: string;
  incumbentType: MutationType;
  incumbentSequence: number;
  incumbentIntent?: string;
}): boolean {
  const incomingPrecedence = getMutationPrecedence(params.incomingType, params.incomingIntent);
  const incumbentPrecedence = getMutationPrecedence(params.incumbentType, params.incumbentIntent);

  if (incomingPrecedence !== incumbentPrecedence) {
    return incomingPrecedence > incumbentPrecedence;
  }

  return params.incomingSequence > params.incumbentSequence;
}
