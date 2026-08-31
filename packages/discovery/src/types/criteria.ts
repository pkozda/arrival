/**
 * Shared criteria envelope for Profile / Run persistence and pipeline.
 * Strategies may narrow Criterion keys via branded helpers, but storage stays this shape.
 *
 * E1 Decision 1: shared envelope (not strategy-private opaque blobs) so the pipeline
 * and registry remain strategy-agnostic while strategies validate/interpret keys they own.
 */

export type CriterionValue = string | number | boolean | null;

export type Criterion = {
  key: string;
  value: CriterionValue;
  /** Optional structured note — never replaces structured required/excluded rules */
  note?: string;
};

export type DiscoveryCriteria = {
  required: Criterion[];
  preferred: Criterion[];
  excluded: Criterion[];
  flexible: Criterion[];
};

export function emptyCriteria(): DiscoveryCriteria {
  return {
    required: [],
    preferred: [],
    excluded: [],
    flexible: [],
  };
}
