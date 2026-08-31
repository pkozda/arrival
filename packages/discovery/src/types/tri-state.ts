/**
 * Three-valued logic for uncertain discovery facts.
 * NEVER coerce UNKNOWN → true / passing.
 */
export type TriState = 'TRUE' | 'FALSE' | 'UNKNOWN';

export function isTriState(value: unknown): value is TriState {
  return value === 'TRUE' || value === 'FALSE' || value === 'UNKNOWN';
}

/** Required facts: only TRUE satisfies. UNKNOWN and FALSE do not. */
export function requiredSatisfied(value: TriState): boolean {
  return value === 'TRUE';
}

/** Optional facts: UNKNOWN does not fail; FALSE fails if the caller treats it as a hard optional. */
export function optionalBlocks(value: TriState): boolean {
  return value === 'FALSE';
}

/**
 * Boolean coercion is forbidden for promotion decisions.
 * Use requiredSatisfied / explicit switches instead.
 */
export function assertNeverCoerceUnknown(_value: TriState): void {
  // Marker for reviewers — do not add Boolean(triState) helpers.
}
